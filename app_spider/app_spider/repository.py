from __future__ import annotations

from datetime import datetime
import json
import logging
import time
from typing import Any

import pymysql

from .config import Settings


def now_ms() -> int:
    return int(time.time() * 1000)


def is_fresh(last_fetched_at: int | None, ttl_hours: int, *, current_ms: int | None = None) -> bool:
    if last_fetched_at is None or ttl_hours <= 0:
        return False
    current = current_ms if current_ms is not None else now_ms()
    return current - int(last_fetched_at) < ttl_hours * 3_600_000


def timestamp_ms(value: Any) -> int | None:
    if value in (None, ""):
        return None
    if isinstance(value, (int, float)):
        number = int(value)
        return number if number > 10_000_000_000 else number * 1000
    text = str(value).strip().replace("Z", "+00:00")
    try:
        return int(datetime.fromisoformat(text).timestamp() * 1000)
    except ValueError:
        return None


def normalize_ranking_rows(apps: list[Any]) -> tuple[list[dict[str, Any]], int, int]:
    valid: list[dict[str, Any]] = []
    failed = 0
    skipped = 0
    seen: set[str] = set()
    for position, raw in enumerate(apps, start=1):
        if not isinstance(raw, dict):
            failed += 1
            continue
        apple_id = str(raw.get("track_id") or "").strip()
        if not apple_id:
            failed += 1
            continue
        if apple_id in seen:
            skipped += 1
            continue
        try:
            rank = int(raw.get("rank") or position)
            if rank <= 0:
                raise ValueError
        except (TypeError, ValueError):
            failed += 1
            continue
        seen.add(apple_id)
        valid.append({"apple_id": apple_id, "rank": rank, "raw": raw})
    return valid, failed, skipped


def normalize_reviews(reviews: list[Any], country: str) -> tuple[list[dict[str, Any]], int, int]:
    normalized: dict[tuple[str, str], dict[str, Any]] = {}
    failed = 0
    skipped = 0
    for raw in reviews:
        if not isinstance(raw, dict):
            failed += 1
            continue
        provider_id = str(raw.get("id") or raw.get("provider_id") or "").strip()
        published_at = timestamp_ms(raw.get("date") or raw.get("published_at"))
        if not provider_id or published_at is None:
            failed += 1
            continue
        try:
            rating = int(raw.get("rating") or 0)
        except (TypeError, ValueError):
            failed += 1
            continue
        item = {
            "provider_id": provider_id,
            "country": country,
            "rating": min(max(rating, 0), 5),
            "title": str(raw.get("title") or ""),
            "body": str(raw.get("content") or raw.get("body") or ""),
            "author": str(raw.get("author") or ""),
            "app_version": str(raw.get("version") or raw.get("app_version") or ""),
            "published_at": published_at,
        }
        key = (provider_id, country)
        if key in normalized:
            skipped += 1
        normalized[key] = item
    return list(normalized.values()), failed, skipped


class Repository:
    def __init__(self, settings: Settings):
        self.connection = pymysql.connect(
            host=settings.mysql_host,
            port=settings.mysql_port,
            user=settings.mysql_user,
            password=settings.mysql_password,
            database=settings.mysql_database,
            charset="utf8mb4",
            autocommit=False,
            connect_timeout=10,
            cursorclass=pymysql.cursors.DictCursor,
        )
        self.ensure_schema()

    def close(self) -> None:
        self.connection.close()

    def _columns(self, table: str) -> set[str]:
        with self.connection.cursor() as cursor:
            cursor.execute(f"SHOW COLUMNS FROM `{table}`")
            return {str(row["Field"]) for row in cursor.fetchall()}

    def ensure_schema(self) -> None:
        with self.connection.cursor() as cursor:
            cursor.execute(
                "CREATE TABLE IF NOT EXISTS app_categories ("
                "id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,country VARCHAR(8) NOT NULL,category_id VARCHAR(64) NOT NULL,"
                "name VARCHAR(255) NOT NULL,parent_id VARCHAR(64),raw_json LONGTEXT,fetched_at BIGINT NOT NULL,PRIMARY KEY (id),"
                "UNIQUE KEY idx_app_categories_country_category (country,category_id),"
                "KEY idx_app_categories_country_parent (country,parent_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
            )
            cursor.execute(
                "CREATE TABLE IF NOT EXISTS review_sync_state ("
                "app_id BIGINT UNSIGNED NOT NULL,country VARCHAR(8) NOT NULL,fetched_at BIGINT NOT NULL,"
                "PRIMARY KEY (app_id,country),CONSTRAINT fk_review_sync_app FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE) "
                "ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
            )
        app_columns = self._columns("apps")
        snapshot_columns = self._columns("app_snapshots")
        with self.connection.cursor() as cursor:
            if "bundle_id" not in app_columns:
                cursor.execute("ALTER TABLE apps ADD COLUMN bundle_id VARCHAR(255) NULL AFTER apple_id")
            additions = {
                "description": "LONGTEXT NULL",
                "release_notes": "LONGTEXT NULL",
                "genres_json": "TEXT NULL",
                "primary_genre": "VARCHAR(255) NULL",
                "currency": "VARCHAR(16) NULL",
                "content_rating": "VARCHAR(32) NULL",
                "minimum_os_version": "VARCHAR(64) NULL",
                "file_size_bytes": "BIGINT NULL",
                "release_date": "BIGINT NULL",
                "current_version_release_date": "BIGINT NULL",
                "screenshots_json": "LONGTEXT NULL",
                "store_url": "TEXT NULL",
            }
            for name, definition in additions.items():
                if name not in snapshot_columns:
                    cursor.execute(f"ALTER TABLE app_snapshots ADD COLUMN `{name}` {definition}")
        self.connection.commit()

    @staticmethod
    def _upsert_app(cursor: Any, raw: dict[str, Any], fetched_at: int, apple_id: str | None = None) -> tuple[int, bool]:
        identifier = apple_id or str(raw.get("track_id") or "").strip()
        if not identifier:
            raise ValueError("App 缺少 track_id")
        cursor.execute(
            "INSERT INTO apps (apple_id,bundle_id,name,developer,icon_url,created_at,updated_at) VALUES (%s,%s,%s,%s,%s,%s,%s) "
            "ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id),bundle_id=COALESCE(VALUES(bundle_id),bundle_id),"
            "name=VALUES(name),developer=VALUES(developer),icon_url=VALUES(icon_url),updated_at=VALUES(updated_at)",
            (
                identifier,
                str(raw.get("bundle_id") or "") or None,
                str(raw.get("track_name") or f"App {identifier}"),
                str(raw.get("artist_name") or "未知开发者"),
                str(raw.get("icon_url") or ""),
                fetched_at,
                fetched_at,
            ),
        )
        return int(cursor.lastrowid), cursor.rowcount == 1

    @staticmethod
    def _ensure_app_id(cursor: Any, apple_id: str, fetched_at: int) -> int:
        cursor.execute("SELECT id FROM apps WHERE apple_id=%s LIMIT 1", (apple_id,))
        row = cursor.fetchone()
        if row:
            return int(row["id"])
        cursor.execute(
            "INSERT INTO apps (apple_id,bundle_id,name,developer,icon_url,created_at,updated_at) VALUES (%s,NULL,%s,%s,%s,%s,%s)",
            (apple_id, f"App {apple_id}", "未知开发者", "", fetched_at, fetched_at),
        )
        return int(cursor.lastrowid)

    def save_categories(self, categories: list[dict[str, Any]], country: str, fetched_at: int | None = None) -> dict[str, int]:
        timestamp = fetched_at or now_ms()
        result = {"received": len(categories), "inserted": 0, "updated": 0, "skipped": 0, "failed": 0}
        with self.connection.cursor() as cursor:
            for item in categories:
                cursor.execute("SAVEPOINT category_item")
                try:
                    category_id = str(item.get("category_id") or "").strip()
                    name = str(item.get("name") or "").strip()
                    if not category_id or not name:
                        raise ValueError("分类缺少 id 或 name")
                    cursor.execute("SELECT id FROM app_categories WHERE country=%s AND category_id=%s", (country, category_id))
                    existed = cursor.fetchone() is not None
                    cursor.execute(
                        "INSERT INTO app_categories (country,category_id,name,parent_id,raw_json,fetched_at) VALUES (%s,%s,%s,%s,%s,%s) "
                        "ON DUPLICATE KEY UPDATE name=VALUES(name),parent_id=VALUES(parent_id),raw_json=VALUES(raw_json),fetched_at=VALUES(fetched_at)",
                        (country, category_id, name, item.get("parent_id"), json.dumps(item.get("raw") or item, ensure_ascii=False), timestamp),
                    )
                    result["updated" if existed else "inserted"] += 1
                    cursor.execute("RELEASE SAVEPOINT category_item")
                except Exception as error:
                    cursor.execute("ROLLBACK TO SAVEPOINT category_item")
                    result["failed"] += 1
                    logging.warning("跳过分类脏数据：%s", error)
        self.connection.commit()
        return result

    def save_ranking(self, apps: list[dict[str, Any]], country: str, category: str, collection: str, fetched_at: int | None = None) -> dict[str, Any]:
        timestamp = fetched_at or now_ms()
        rows, failed, skipped = normalize_ranking_rows(apps)
        result: dict[str, Any] = {"received": len(apps), "inserted": 0, "updated": 0, "skipped": skipped, "failed": failed, "apple_ids": []}
        with self.connection.cursor() as cursor:
            for item in rows:
                cursor.execute("SAVEPOINT ranking_item")
                try:
                    app_id, created = self._upsert_app(cursor, item["raw"], timestamp, item["apple_id"])
                    cursor.execute(
                        "INSERT INTO ranking_snapshots (app_id,country,category,collection,`rank`,fetched_at) VALUES (%s,%s,%s,%s,%s,%s)",
                        (app_id, country, category or "all", collection, item["rank"], timestamp),
                    )
                    result["inserted"] += 1
                    if not created:
                        result["updated"] += 1
                    result["apple_ids"].append(item["apple_id"])
                    cursor.execute("RELEASE SAVEPOINT ranking_item")
                except Exception as error:
                    cursor.execute("ROLLBACK TO SAVEPOINT ranking_item")
                    result["failed"] += 1
                    logging.warning("跳过榜单脏数据 apple_id=%s：%s", item["apple_id"], error)
        self.connection.commit()
        return result

    def latest_detail_fetched_at(self, apple_id: str, country: str) -> int | None:
        with self.connection.cursor() as cursor:
            cursor.execute(
                "SELECT MAX(s.fetched_at) fetched_at FROM app_snapshots s JOIN apps a ON a.id=s.app_id "
                "WHERE a.apple_id=%s AND s.country=%s AND s.description IS NOT NULL",
                (apple_id, country),
            )
            row = cursor.fetchone()
            return int(row["fetched_at"]) if row and row["fetched_at"] is not None else None

    def save_app_detail(self, raw: dict[str, Any], country: str, fetched_at: int | None = None, apple_id: str | None = None) -> dict[str, Any]:
        timestamp = fetched_at or now_ms()
        identifier = apple_id or str(raw.get("track_id") or "").strip()
        with self.connection.cursor() as cursor:
            app_id, created = self._upsert_app(cursor, raw, timestamp, identifier)
            cursor.execute(
                "INSERT INTO app_snapshots (app_id,country,version,price,rating,rating_count,description,release_notes,genres_json,primary_genre,"
                "currency,content_rating,minimum_os_version,file_size_bytes,release_date,current_version_release_date,screenshots_json,store_url,raw_json,fetched_at) "
                "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                (
                    app_id,
                    country,
                    raw.get("version"),
                    raw.get("price"),
                    raw.get("rating"),
                    raw.get("rating_count"),
                    raw.get("description"),
                    raw.get("release_notes") or raw.get("releaseNotes"),
                    json.dumps(raw.get("genres") or [], ensure_ascii=False),
                    raw.get("primary_genre"),
                    raw.get("currency"),
                    raw.get("content_rating"),
                    raw.get("minimum_os_version"),
                    int(raw["file_size_bytes"]) if raw.get("file_size_bytes") not in (None, "") else None,
                    timestamp_ms(raw.get("release_date")),
                    timestamp_ms(raw.get("current_version_release_date")),
                    json.dumps(raw.get("screenshot_urls") or [], ensure_ascii=False),
                    raw.get("track_view_url"),
                    json.dumps(raw, ensure_ascii=False, separators=(",", ":")),
                    timestamp,
                ),
            )
        self.connection.commit()
        return {"received": 1, "inserted": 1, "updated": 0 if created else 1, "skipped": 0, "failed": 0, "apple_id": identifier}

    def latest_review_fetched_at(self, apple_id: str, country: str) -> int | None:
        with self.connection.cursor() as cursor:
            cursor.execute(
                "SELECT s.fetched_at FROM review_sync_state s JOIN apps a ON a.id=s.app_id WHERE a.apple_id=%s AND s.country=%s",
                (apple_id, country),
            )
            row = cursor.fetchone()
            return int(row["fetched_at"]) if row else None

    def save_reviews(self, apple_id: str, country: str, reviews: list[dict[str, Any]], fetched_at: int | None = None) -> dict[str, int]:
        timestamp = fetched_at or now_ms()
        rows, failed, skipped = normalize_reviews(reviews, country)
        result = {"received": len(reviews), "inserted": 0, "updated": 0, "skipped": skipped, "failed": failed}
        with self.connection.cursor() as cursor:
            app_id = self._ensure_app_id(cursor, apple_id, timestamp)
            for item in rows:
                cursor.execute("SAVEPOINT review_item")
                try:
                    cursor.execute("SELECT id FROM reviews WHERE provider_id=%s AND country=%s", (item["provider_id"], country))
                    existed = cursor.fetchone() is not None
                    cursor.execute(
                        "INSERT INTO reviews (provider_id,app_id,country,rating,title,body,author,app_version,published_at) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) "
                        "ON DUPLICATE KEY UPDATE app_id=VALUES(app_id),rating=VALUES(rating),title=VALUES(title),body=VALUES(body),author=VALUES(author),app_version=VALUES(app_version),published_at=VALUES(published_at)",
                        (item["provider_id"], app_id, country, item["rating"], item["title"], item["body"], item["author"], item["app_version"], item["published_at"]),
                    )
                    result["updated" if existed else "inserted"] += 1
                    cursor.execute("RELEASE SAVEPOINT review_item")
                except Exception as error:
                    cursor.execute("ROLLBACK TO SAVEPOINT review_item")
                    result["failed"] += 1
                    logging.warning("跳过评论脏数据 provider_id=%s：%s", item["provider_id"], error)
            cursor.execute(
                "INSERT INTO review_sync_state (app_id,country,fetched_at) VALUES (%s,%s,%s) ON DUPLICATE KEY UPDATE fetched_at=VALUES(fetched_at)",
                (app_id, country, timestamp),
            )
        self.connection.commit()
        return result

    def priority_apple_ids(self, country: str, collections: tuple[str, ...], top_n: int) -> list[str]:
        result: list[str] = []
        seen: set[str] = set()
        with self.connection.cursor() as cursor:
            for collection in collections:
                cursor.execute(
                    "SELECT a.apple_id FROM ranking_snapshots r JOIN apps a ON a.id=r.app_id "
                    "WHERE r.country=%s AND r.category='all' AND r.collection=%s AND r.fetched_at=("
                    "SELECT MAX(fetched_at) FROM ranking_snapshots WHERE country=%s AND category='all' AND collection=%s) "
                    "AND r.rank<=%s ORDER BY r.rank",
                    (country, collection, country, collection, top_n),
                )
                for row in cursor.fetchall():
                    apple_id = str(row["apple_id"])
                    if apple_id not in seen:
                        seen.add(apple_id)
                        result.append(apple_id)
        return result

    def ranking_changes(self, country: str, category: str, collection: str) -> list[dict[str, Any]]:
        with self.connection.cursor() as cursor:
            cursor.execute(
                "SELECT DISTINCT fetched_at FROM ranking_snapshots WHERE country=%s AND category=%s AND collection=%s ORDER BY fetched_at DESC LIMIT 2",
                (country, category, collection),
            )
            batches = [int(row["fetched_at"]) for row in cursor.fetchall()]
            if len(batches) < 2:
                return []
            cursor.execute(
                "SELECT a.apple_id,r.rank,r.fetched_at FROM ranking_snapshots r JOIN apps a ON a.id=r.app_id "
                "WHERE r.country=%s AND r.category=%s AND r.collection=%s AND r.fetched_at IN (%s,%s)",
                (country, category, collection, batches[0], batches[1]),
            )
            current: dict[str, int] = {}
            previous: dict[str, int] = {}
            for row in cursor.fetchall():
                target = current if int(row["fetched_at"]) == batches[0] else previous
                target[str(row["apple_id"])] = int(row["rank"])
            return [
                {"apple_id": apple_id, "previous_rank": previous.get(apple_id), "current_rank": rank, "change": None if apple_id not in previous else previous[apple_id] - rank}
                for apple_id, rank in current.items()
            ]
