from __future__ import annotations

import json
import time
from typing import Any

import pymysql

from .config import Settings


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

    def close(self) -> None:
        self.connection.close()

    def save_ranking(self, apps: list[dict[str, Any]], country: str, category: str, collection: str) -> int:
        fetched_at = int(time.time() * 1000)
        try:
            with self.connection.cursor() as cursor:
                for position, raw in enumerate(apps, start=1):
                    apple_id = str(raw.get("track_id") or "").strip()
                    if not apple_id:
                        raise ValueError(f"第 {position} 条数据缺少 track_id")
                    rank = int(raw.get("rank") or position)
                    name = str(raw.get("track_name") or "未命名 App")
                    developer = str(raw.get("artist_name") or "未知开发者")
                    icon_url = str(raw.get("icon_url") or "")
                    cursor.execute(
                        "INSERT INTO apps (apple_id,name,developer,icon_url,created_at,updated_at) VALUES (%s,%s,%s,%s,%s,%s) "
                        "ON DUPLICATE KEY UPDATE name=VALUES(name),developer=VALUES(developer),icon_url=VALUES(icon_url),updated_at=VALUES(updated_at)",
                        (apple_id, name, developer, icon_url, fetched_at, fetched_at),
                    )
                    cursor.execute("SELECT id FROM apps WHERE apple_id=%s LIMIT 1", (apple_id,))
                    app_id = cursor.fetchone()["id"]
                    cursor.execute(
                        "INSERT INTO ranking_snapshots (app_id,country,category,collection,`rank`,fetched_at) VALUES (%s,%s,%s,%s,%s,%s)",
                        (app_id, country, category or "all", collection, rank, fetched_at),
                    )
                    cursor.execute(
                        "INSERT INTO app_snapshots (app_id,country,version,price,rating,rating_count,raw_json,fetched_at) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)",
                        (
                            app_id,
                            country,
                            raw.get("version"),
                            raw.get("price"),
                            raw.get("rating"),
                            raw.get("rating_count"),
                            json.dumps(raw, ensure_ascii=False, separators=(",", ":")),
                            fetched_at,
                        ),
                    )
            self.connection.commit()
            return len(apps)
        except Exception:
            self.connection.rollback()
            raise

