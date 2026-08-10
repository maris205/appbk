from __future__ import annotations

import argparse
import json
import logging
from pathlib import Path
import sys
import time

from .api_client import ApiClient
from .config import Settings
from .repository import Repository

ALLOWED_COLLECTIONS = {"topfreeapplications", "toppaidapplications", "topgrossingapplications"}


def setup_logging(settings: Settings) -> None:
    path = Path(settings.log_file)
    path.parent.mkdir(parents=True, exist_ok=True)
    logging.basicConfig(
        level=getattr(logging, settings.log_level, logging.INFO),
        format="%(asctime)s %(levelname)s %(message)s",
        handlers=[logging.StreamHandler(), logging.FileHandler(path, encoding="utf-8")],
    )


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(description="appbk iOS 公共数据采集器")
    commands = root.add_subparsers(dest="command", required=True)
    categories = commands.add_parser("categories", help="读取 App Store 分类")
    categories.add_argument("--country", default="cn")
    rankings = commands.add_parser("rankings", help="采集一个 iOS 榜单")
    rankings.add_argument("--country", default="cn")
    rankings.add_argument("--collection", default="topfreeapplications", choices=sorted(ALLOWED_COLLECTIONS))
    rankings.add_argument("--category", default="all")
    rankings.add_argument("--limit", type=int)
    rankings.add_argument("--dry-run", action="store_true")
    daily = commands.add_parser("run-daily", help="采集配置中的国家和榜单")
    daily.add_argument("--dry-run", action="store_true")
    return root


def collect_ranking(settings: Settings, country: str, collection: str, category: str, limit: int, dry_run: bool) -> dict[str, object]:
    started = time.monotonic()
    client = ApiClient(settings)
    repository = None
    try:
        apps = client.rankings(country, collection, category, limit)
        written = 0
        if not dry_run:
            repository = Repository(settings)
            written = repository.save_ranking(apps, country, category, collection)
        result = {"country": country, "category": category, "collection": collection, "received": len(apps), "written": written, "dry_run": dry_run, "requests": client.request_count, "duration_ms": int((time.monotonic() - started) * 1000)}
        logging.info("ranking_result=%s", json.dumps(result, ensure_ascii=False))
        return result
    finally:
        if repository:
            repository.close()
        client.close()


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    try:
        dry_run = bool(getattr(args, "dry_run", False))
        settings = Settings.load(require_mysql=not dry_run and args.command != "categories")
        setup_logging(settings)
        if args.command == "categories":
            client = ApiClient(settings)
            try:
                data = client.categories(args.country.lower())
                print(json.dumps(data, ensure_ascii=False, indent=2))
            finally:
                client.close()
            return 0
        if args.command == "rankings":
            limit = min(max(args.limit or settings.ranking_limit, 1), 100)
            result = collect_ranking(settings, args.country.lower(), args.collection, args.category, limit, args.dry_run)
            print(json.dumps(result, ensure_ascii=False, indent=2))
            return 0
        results = []
        for country in settings.countries:
            for collection in settings.collections:
                if collection not in ALLOWED_COLLECTIONS:
                    logging.warning("跳过不支持的 collection=%s", collection)
                    continue
                results.append(collect_ranking(settings, country.lower(), collection, "all", settings.ranking_limit, args.dry_run))
        print(json.dumps(results, ensure_ascii=False, indent=2))
        return 0
    except Exception as error:
        logging.exception("任务失败：%s", error)
        print(f"error: {error}", file=sys.stderr)
        return 1

