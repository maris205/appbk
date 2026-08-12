from dataclasses import replace
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import httpx

from app_spider.api_client import ApiClient, flatten_categories
from app_spider.config import Settings
from app_spider.repository import is_fresh, normalize_ranking_rows, normalize_reviews, timestamp_ms
from app_spider.usage import BudgetExceeded, NonCoreBudgetExceeded, UsageLedger


def load_settings(directory: str, **spider_overrides: object) -> Settings:
    spider = {
        "request_interval_ms": 0,
        "daily_request_limit": 10,
        "monthly_request_limit": 100,
        "budget_non_core_ratio": 0.9,
        "usage_file": str(Path(directory) / "usage.json"),
        **spider_overrides,
    }
    config = Path(directory) / "config.yaml"
    config.write_text(
        "rapidapi:\n  base_url: https://api.example.test\n  host: api.example.test\n  key: test-key\n  request_interval_ms: 0\n  monthly_budget: 30000\n"
        "mysql:\n  host: db.example\n  user: appbk\n  password: secret\n  database: appbk\n"
        "spider:\n" + "".join(f"  {key}: {json.dumps(value)}\n" for key, value in spider.items()),
        encoding="utf-8",
    )
    with patch.dict(os.environ, {"APP_SPIDER_CONFIG": str(config), "PYTHON_DOTENV_DISABLED": "1"}, clear=True):
        return Settings.load()


class NormalizationTests(unittest.TestCase):
    def test_flattens_nested_categories(self):
        rows = flatten_categories([{"id": "1", "name": "Games", "children": [{"id": "2", "name": "Action"}]}])
        self.assertEqual([(row["category_id"], row["parent_id"]) for row in rows], [("1", None), ("2", "1")])

    def test_dirty_ranking_row_does_not_remove_valid_rows(self):
        rows, failed, skipped = normalize_ranking_rows([
            {"track_id": 1, "rank": 1},
            {"rank": 2},
            {"track_id": 1, "rank": 3},
            {"track_id": 2, "rank": "bad"},
        ])
        self.assertEqual([row["apple_id"] for row in rows], ["1"])
        self.assertEqual(failed, 2)
        self.assertEqual(skipped, 1)

    def test_review_deduplication_uses_provider_and_country(self):
        rows, failed, skipped = normalize_reviews([
            {"id": "r1", "rating": 4, "content": "old", "date": "2026-08-10T00:00:00Z"},
            {"id": "r1", "rating": 5, "content": "new", "date": "2026-08-10T01:00:00Z"},
            {"id": "", "date": "bad"},
            {"id": "r2", "rating": "bad", "date": "2026-08-10T02:00:00Z"},
        ], "cn")
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["body"], "new")
        self.assertEqual(failed, 2)
        self.assertEqual(skipped, 1)

    def test_ttl_and_timestamp_helpers(self):
        now = 2_000_000_000_000
        self.assertTrue(is_fresh(now - 3_599_000, 1, current_ms=now))
        self.assertFalse(is_fresh(now - 3_600_000, 1, current_ms=now))
        self.assertEqual(timestamp_ms("2026-08-10T00:00:00Z"), 1786320000000)


class UsageLedgerTests(unittest.TestCase):
    def test_stops_non_core_at_ninety_percent_but_allows_core_until_hard_limit(self):
        with tempfile.TemporaryDirectory() as directory:
            settings = load_settings(directory)
            ledger = UsageLedger(settings)
            now = datetime(2026, 8, 11, tzinfo=timezone.utc)
            for _ in range(9):
                ledger.consume(now=now)
            with self.assertRaises(NonCoreBudgetExceeded):
                ledger.consume(now=now)
            ledger.consume(essential=True, now=now)
            with self.assertRaises(BudgetExceeded):
                ledger.consume(essential=True, now=now)
            snapshot = ledger.snapshot(now=now)
            self.assertEqual(snapshot.daily_requests, 10)


class ApiClientTests(unittest.TestCase):
    def test_reviews_support_pagination(self):
        with tempfile.TemporaryDirectory() as directory:
            settings = load_settings(directory)
            offsets: list[int] = []

            def handler(request: httpx.Request) -> httpx.Response:
                offset = int(request.url.params["offset"])
                limit = int(request.url.params["limit"])
                offsets.append(offset)
                rows = [{"id": f"r{index}"} for index in range(offset, min(offset + limit, 3))]
                return httpx.Response(200, json={"success": True, "data": rows})

            client = ApiClient(settings, transport=httpx.MockTransport(handler))
            try:
                rows = client.reviews("123", "cn", 3, page_size=2)
            finally:
                client.close()
            self.assertEqual(len(rows), 3)
            self.assertEqual(offsets, [0, 2])
            self.assertEqual(client.request_count, 2)

    def test_authentication_failure_is_not_retried(self):
        with tempfile.TemporaryDirectory() as directory:
            settings = replace(load_settings(directory), max_retries=4)
            calls = 0

            def handler(request: httpx.Request) -> httpx.Response:
                nonlocal calls
                calls += 1
                return httpx.Response(401, json={"message": "unauthorized"})

            client = ApiClient(settings, transport=httpx.MockTransport(handler))
            try:
                with self.assertRaises(httpx.HTTPStatusError):
                    client.categories("cn")
            finally:
                client.close()
            self.assertEqual(calls, 1)
            self.assertEqual(client.request_count, 1)


if __name__ == "__main__":
    unittest.main()
