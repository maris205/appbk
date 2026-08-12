from __future__ import annotations

import argparse
import json
import logging
from pathlib import Path
import sys
import time
from typing import Any, Callable

import httpx

from .api_client import ApiClient, flatten_categories
from .config import Settings
from .repository import Repository, is_fresh, normalize_ranking_rows, normalize_reviews
from .usage import BudgetExceeded, NonCoreBudgetExceeded

ALLOWED_COLLECTIONS = {"topfreeapplications", "toppaidapplications", "topgrossingapplications"}
REVIEW_COLLECTIONS = ("topfreeapplications", "topgrossingapplications")


def setup_logging(settings: Settings) -> None:
    path = Path(settings.log_file)
    path.parent.mkdir(parents=True, exist_ok=True)
    logging.basicConfig(
        level=getattr(logging, settings.log_level, logging.INFO),
        format="%(asctime)s %(levelname)s %(message)s",
        handlers=[logging.StreamHandler(), logging.FileHandler(path, encoding="utf-8")],
    )


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(description="appbk iOS 公共数据采集器 V2")
    commands = root.add_subparsers(dest="command", required=True)

    categories = commands.add_parser("categories", help="读取 App Store 分类，不写数据库")
    categories.add_argument("--country", default="cn")

    sync_categories = commands.add_parser("sync-categories", help="采集并持久化 App Store 分类")
    sync_categories.add_argument("--country", default="cn")
    sync_categories.add_argument("--dry-run", action="store_true")

    rankings = commands.add_parser("rankings", help="采集一个 iOS 榜单")
    rankings.add_argument("--country", default="cn")
    rankings.add_argument("--collection", default="topfreeapplications", choices=sorted(ALLOWED_COLLECTIONS))
    rankings.add_argument("--category", default="all")
    rankings.add_argument("--limit", type=int)
    rankings.add_argument("--dry-run", action="store_true")

    detail = commands.add_parser("app-detail", help="采集一个 App 的详情快照")
    detail.add_argument("--app-id", required=True)
    detail.add_argument("--country", default="cn")
    detail.add_argument("--force", action="store_true")
    detail.add_argument("--dry-run", action="store_true")

    reviews = commands.add_parser("reviews", help="采集一个 App 的最新评论")
    reviews.add_argument("--app-id", required=True)
    reviews.add_argument("--country", default="cn")
    reviews.add_argument("--limit", type=int)
    reviews.add_argument("--force", action="store_true")
    reviews.add_argument("--dry-run", action="store_true")

    daily = commands.add_parser("run-daily", help="采集配置中的三个市场总榜")
    daily.add_argument("--dry-run", action="store_true")

    public_daily = commands.add_parser("run-public-daily", help="运行分类、分类榜、详情和优先评论的每日公共数据任务")
    public_daily.add_argument("--dry-run", action="store_true")
    return root


def _base_result(task: str, started: float, requests: int, dry_run: bool, **metadata: Any) -> dict[str, Any]:
    return {
        "task": task,
        **metadata,
        "received": 0,
        "inserted": 0,
        "updated": 0,
        "skipped": 0,
        "failed": 0,
        "written": 0,
        "dry_run": dry_run,
        "requests": requests,
        "duration_ms": int((time.monotonic() - started) * 1000),
    }


def _finish(result: dict[str, Any], started: float, request_count: int, request_before: int, dry_run: bool) -> dict[str, Any]:
    result["dry_run"] = dry_run
    result.setdefault("written", result.get("inserted", 0) + result.get("updated", 0))
    result["requests"] = request_count - request_before
    result["duration_ms"] = int((time.monotonic() - started) * 1000)
    return result


def _public(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: _public(item) for key, item in value.items() if not key.startswith("_")}
    if isinstance(value, list):
        return [_public(item) for item in value]
    return value


def collect_categories(
    settings: Settings,
    country: str,
    dry_run: bool,
    *,
    client: ApiClient | None = None,
    repository: Repository | None = None,
) -> dict[str, Any]:
    started = time.monotonic()
    owns_client = client is None
    owns_repository = repository is None and not dry_run
    api = client or ApiClient(settings)
    repo = repository or (Repository(settings) if not dry_run else None)
    before = api.request_count
    try:
        raw = api.categories(country)
        categories = flatten_categories(raw)
        if dry_run:
            result = {"task": "sync-categories", "country": country, "received": len(raw), "inserted": 0, "updated": 0, "skipped": max(len(raw) - len(categories), 0), "failed": 0}
        else:
            assert repo is not None
            result = {"task": "sync-categories", "country": country, **repo.save_categories(categories, country)}
        result["_categories"] = categories
        return _finish(result, started, api.request_count, before, dry_run)
    finally:
        if owns_repository and repo:
            repo.close()
        if owns_client:
            api.close()


def collect_ranking(
    settings: Settings,
    country: str,
    collection: str,
    category: str,
    limit: int,
    dry_run: bool,
    *,
    client: ApiClient | None = None,
    repository: Repository | None = None,
) -> dict[str, Any]:
    started = time.monotonic()
    owns_client = client is None
    owns_repository = repository is None and not dry_run
    api = client or ApiClient(settings)
    repo = repository or (Repository(settings) if not dry_run else None)
    before = api.request_count
    try:
        apps = api.rankings(country, collection, category, limit)
        if dry_run:
            rows, failed, skipped = normalize_ranking_rows(apps)
            result: dict[str, Any] = {"received": len(apps), "inserted": 0, "updated": 0, "skipped": skipped, "failed": failed, "apple_ids": [row["apple_id"] for row in rows]}
        else:
            assert repo is not None
            result = repo.save_ranking(apps, country, category, collection)
        result.update({"task": "rankings", "country": country, "category": category or "all", "collection": collection})
        result["written"] = 0 if dry_run else result.get("inserted", 0)
        result["_apple_ids"] = result.pop("apple_ids", [])
        final = _finish(result, started, api.request_count, before, dry_run)
        logging.info("ranking_result=%s", json.dumps(_public(final), ensure_ascii=False))
        return final
    finally:
        if owns_repository and repo:
            repo.close()
        if owns_client:
            api.close()


def collect_app_detail(
    settings: Settings,
    app_id: str,
    country: str,
    dry_run: bool,
    force: bool,
    *,
    client: ApiClient | None = None,
    repository: Repository | None = None,
) -> dict[str, Any]:
    started = time.monotonic()
    owns_client = client is None
    owns_repository = repository is None and not dry_run
    api = client or ApiClient(settings)
    repo = repository or (Repository(settings) if not dry_run else None)
    before = api.request_count
    try:
        if not dry_run and not force and repo and is_fresh(repo.latest_detail_fetched_at(app_id, country), settings.app_detail_ttl_hours):
            return _finish({"task": "app-detail", "app_id": app_id, "country": country, "received": 0, "inserted": 0, "updated": 0, "skipped": 1, "failed": 0, "reason": "ttl"}, started, api.request_count, before, dry_run)
        raw = api.app_detail(app_id, country)
        if not str(raw.get("track_id") or app_id).strip():
            raise RuntimeError("App 详情缺少 track_id")
        if dry_run:
            result = {"received": 1, "inserted": 0, "updated": 0, "skipped": 0, "failed": 0}
        else:
            assert repo is not None
            result = repo.save_app_detail(raw, country, apple_id=app_id)
        result.update({"task": "app-detail", "app_id": app_id, "country": country})
        result["written"] = 0 if dry_run else result.get("inserted", 0)
        return _finish(result, started, api.request_count, before, dry_run)
    finally:
        if owns_repository and repo:
            repo.close()
        if owns_client:
            api.close()


def collect_reviews(
    settings: Settings,
    app_id: str,
    country: str,
    limit: int,
    dry_run: bool,
    force: bool,
    *,
    client: ApiClient | None = None,
    repository: Repository | None = None,
) -> dict[str, Any]:
    started = time.monotonic()
    owns_client = client is None
    owns_repository = repository is None and not dry_run
    api = client or ApiClient(settings)
    repo = repository or (Repository(settings) if not dry_run else None)
    before = api.request_count
    try:
        if not dry_run and not force and repo and is_fresh(repo.latest_review_fetched_at(app_id, country), settings.review_ttl_hours):
            return _finish({"task": "reviews", "app_id": app_id, "country": country, "received": 0, "inserted": 0, "updated": 0, "skipped": 1, "failed": 0, "reason": "ttl"}, started, api.request_count, before, dry_run)
        raw = api.reviews(app_id, country, limit)
        if dry_run:
            rows, failed, skipped = normalize_reviews(raw, country)
            result = {"received": len(raw), "inserted": 0, "updated": 0, "skipped": skipped, "failed": failed, "_validated": len(rows)}
        else:
            assert repo is not None
            result = repo.save_reviews(app_id, country, raw)
        result.update({"task": "reviews", "app_id": app_id, "country": country})
        return _finish(result, started, api.request_count, before, dry_run)
    finally:
        if owns_repository and repo:
            repo.close()
        if owns_client:
            api.close()


def run_total_rankings(settings: Settings, dry_run: bool) -> list[dict[str, Any]]:
    client = ApiClient(settings)
    repository = None if dry_run else Repository(settings)
    results: list[dict[str, Any]] = []
    try:
        for country in settings.countries:
            for collection in settings.collections:
                if collection not in ALLOWED_COLLECTIONS:
                    logging.warning("跳过不支持的 collection=%s", collection)
                    continue
                results.append(collect_ranking(settings, country.lower(), collection, "all", settings.ranking_limit, dry_run, client=client, repository=repository))
        return results
    finally:
        if repository:
            repository.close()
        client.close()


def _run_non_core(action: Callable[[], dict[str, Any]], results: list[dict[str, Any]]) -> bool:
    try:
        results.append(action())
        return True
    except NonCoreBudgetExceeded as error:
        logging.warning("停止非核心任务：%s", error)
        results.append({"task": "budget-stop", "reason": str(error), "received": 0, "inserted": 0, "updated": 0, "skipped": 1, "failed": 0, "written": 0, "requests": 0, "duration_ms": 0})
        return False
    except httpx.HTTPStatusError as error:
        if error.response.status_code in {401, 403}:
            raise
        logging.exception("非核心任务请求失败，继续后续任务：%s", error)
        results.append({"task": "task-error", "reason": str(error), "received": 0, "inserted": 0, "updated": 0, "skipped": 0, "failed": 1, "written": 0, "requests": 0, "duration_ms": 0})
        return True
    except Exception as error:
        logging.exception("非核心任务失败，继续后续任务：%s", error)
        results.append({"task": "task-error", "reason": str(error), "received": 0, "inserted": 0, "updated": 0, "skipped": 0, "failed": 1, "written": 0, "requests": 0, "duration_ms": 0})
        return True


def run_public_daily(settings: Settings, dry_run: bool) -> dict[str, Any]:
    started = time.monotonic()
    client = ApiClient(settings)
    repository = None if dry_run else Repository(settings)
    results: list[dict[str, Any]] = []
    category_ids: dict[str, list[str]] = {}
    ranking_app_ids: list[tuple[str, str]] = []
    priority_ids: dict[str, list[str]] = {country: [] for country in settings.countries}
    try:
        for country in settings.countries:
            for collection in settings.collections:
                if collection not in ALLOWED_COLLECTIONS:
                    continue
                result = collect_ranking(settings, country, collection, "all", settings.ranking_limit, dry_run, client=client, repository=repository)
                results.append(result)
                ids = list(result.get("_apple_ids") or [])
                ranking_app_ids.extend((country, app_id) for app_id in ids)
                if collection in REVIEW_COLLECTIONS:
                    priority_ids[country].extend(ids[: settings.review_top_n])

        for country in settings.countries:
            if not _run_non_core(lambda c=country: collect_categories(settings, c, dry_run, client=client, repository=repository), results):
                return _daily_result(started, client, results)
            category_ids[country] = [item["category_id"] for item in results[-1].get("_categories") or []]

        if settings.category_rankings_enabled:
            for country, categories in category_ids.items():
                for category in categories:
                    for collection in settings.collections:
                        if collection not in ALLOWED_COLLECTIONS:
                            continue
                        holder: list[dict[str, Any]] = []
                        if not _run_non_core(lambda c=country, x=collection, g=category: collect_ranking(settings, c, x, g, settings.ranking_limit, dry_run, client=client, repository=repository), holder):
                            results.extend(holder)
                            return _daily_result(started, client, results)
                        result = holder[0]
                        results.append(result)
                        ranking_app_ids.extend((country, app_id) for app_id in result.get("_apple_ids") or [])

        for country, app_ids in priority_ids.items():
            for app_id in dict.fromkeys(app_ids):
                if not _run_non_core(lambda c=country, a=app_id: collect_reviews(settings, a, c, settings.review_limit, dry_run, False, client=client, repository=repository), results):
                    return _daily_result(started, client, results)

        seen_apps: set[tuple[str, str]] = set()
        for country, app_id in ranking_app_ids:
            key = (country, app_id)
            if key in seen_apps:
                continue
            seen_apps.add(key)
            if not _run_non_core(lambda c=country, a=app_id: collect_app_detail(settings, a, c, dry_run, False, client=client, repository=repository), results):
                return _daily_result(started, client, results)
        return _daily_result(started, client, results)
    finally:
        if repository:
            repository.close()
        client.close()


def _daily_result(started: float, client: ApiClient, results: list[dict[str, Any]]) -> dict[str, Any]:
    usage = client.usage_ledger.snapshot()
    return {
        "task": "run-public-daily",
        "results": results,
        "requests": client.request_count,
        "duration_ms": int((time.monotonic() - started) * 1000),
        "usage": {
            "day": usage.day,
            "daily_requests": usage.daily_requests,
            "daily_limit": usage.daily_limit,
            "month": usage.month,
            "monthly_requests": usage.monthly_requests,
            "monthly_limit": usage.monthly_limit,
        },
    }


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    try:
        dry_run = bool(getattr(args, "dry_run", False))
        settings = Settings.load(require_mysql=not dry_run and args.command != "categories")
        setup_logging(settings)
        country = str(getattr(args, "country", "cn")).lower()
        if args.command == "categories":
            client = ApiClient(settings)
            try:
                print(json.dumps(client.categories(country), ensure_ascii=False, indent=2))
            finally:
                client.close()
            return 0
        if args.command == "sync-categories":
            result = collect_categories(settings, country, args.dry_run)
        elif args.command == "rankings":
            limit = min(max(args.limit or settings.ranking_limit, 1), 100)
            result = collect_ranking(settings, country, args.collection, args.category, limit, args.dry_run)
        elif args.command == "app-detail":
            result = collect_app_detail(settings, str(args.app_id), country, args.dry_run, args.force)
        elif args.command == "reviews":
            limit = min(max(args.limit or settings.review_limit, 1), 500)
            result = collect_reviews(settings, str(args.app_id), country, limit, args.dry_run, args.force)
        elif args.command == "run-daily":
            result = run_total_rankings(settings, args.dry_run)
        else:
            result = run_public_daily(settings, args.dry_run)
        print(json.dumps(_public(result), ensure_ascii=False, indent=2))
        return 0
    except BudgetExceeded as error:
        logging.error("预算停止：%s", error)
        print(f"error: {error}", file=sys.stderr)
        return 2
    except Exception as error:
        logging.exception("任务失败：%s", error)
        print(f"error: {error}", file=sys.stderr)
        return 1
