from __future__ import annotations

import time
from typing import Any

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from .config import Settings
from .usage import UsageLedger


class RetryableApiError(RuntimeError):
    pass


class ApiClient:
    def __init__(self, settings: Settings, *, transport: httpx.BaseTransport | None = None, usage_ledger: UsageLedger | None = None):
        self.settings = settings
        self.request_count = 0
        self._last_request_at = 0.0
        self.usage_ledger = usage_ledger or UsageLedger(settings)
        self._client = httpx.Client(
            base_url=settings.rapidapi_base_url,
            timeout=settings.timeout_seconds,
            transport=transport,
            headers={
                "Content-Type": "application/json",
                "x-rapidapi-host": settings.rapidapi_host,
                "x-rapidapi-key": settings.rapidapi_key,
            },
        )

    def close(self) -> None:
        self._client.close()

    def _throttle(self) -> None:
        interval = self.settings.request_interval_ms / 1000
        remaining = interval - (time.monotonic() - self._last_request_at)
        if remaining > 0:
            time.sleep(remaining)

    def _request_once(self, path: str, params: dict[str, Any], essential: bool) -> dict[str, Any]:
        self._throttle()
        self.usage_ledger.consume(essential=essential)
        self.request_count += 1
        response = self._client.get(path, params=params)
        self._last_request_at = time.monotonic()
        if response.status_code == 429 or 500 <= response.status_code < 600:
            raise RetryableApiError(f"上游暂时失败：HTTP {response.status_code}")
        response.raise_for_status()
        payload = response.json()
        if not payload.get("success", False):
            raise RuntimeError(str(payload.get("message") or "上游返回失败"))
        return payload

    def get(self, path: str, params: dict[str, Any], *, essential: bool = False) -> dict[str, Any]:
        call = retry(
            retry=retry_if_exception_type((RetryableApiError, httpx.TimeoutException, httpx.NetworkError)),
            stop=stop_after_attempt(self.settings.max_retries),
            wait=wait_exponential(multiplier=1, min=1, max=10),
            reraise=True,
        )(self._request_once)
        return call(path, params, essential)

    def categories(self, country: str) -> list[dict[str, Any]]:
        payload = self.get("/ios/categories", {"country": country, "lang": language_for(country)})
        data = payload.get("data")
        if not isinstance(data, list):
            raise RuntimeError("分类接口 data 不是数组")
        return data

    def rankings(self, country: str, collection: str, category: str, limit: int) -> list[dict[str, Any]]:
        params: dict[str, Any] = {"country": country, "lang": language_for(country), "limit": limit, "offset": 0}
        if category and category != "all":
            params["category"] = category
        payload = self.get(f"/ios/top/{collection}", params, essential=not category or category == "all")
        data = payload.get("data")
        if not isinstance(data, list):
            raise RuntimeError("榜单接口 data 不是数组")
        return data

    def app_detail(self, app_id: str, country: str) -> dict[str, Any]:
        payload = self.get(f"/ios/apps/{app_id}", {"country": country, "lang": language_for(country)})
        data = payload.get("data")
        if not isinstance(data, dict):
            raise RuntimeError("App 详情接口 data 不是对象")
        return data

    def reviews(self, app_id: str, country: str, limit: int, *, page_size: int = 100) -> list[dict[str, Any]]:
        result: list[dict[str, Any]] = []
        page_size = min(max(page_size, 1), 100)
        offset = 0
        while len(result) < limit:
            size = min(page_size, limit - len(result))
            payload = self.get(
                f"/ios/apps/{app_id}/reviews",
                {"country": country, "lang": language_for(country), "limit": size, "offset": offset},
            )
            data = payload.get("data")
            if not isinstance(data, list):
                raise RuntimeError("评论接口 data 不是数组")
            page = [item for item in data if isinstance(item, dict)]
            result.extend(page)
            offset += len(data)
            if len(data) < size:
                break
        return result


def flatten_categories(categories: list[dict[str, Any]]) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []

    def visit(items: list[Any], parent_id: str | None = None) -> None:
        for raw in items:
            if not isinstance(raw, dict):
                continue
            category_id = str(raw.get("id") or raw.get("category_id") or "").strip()
            name = str(raw.get("name") or "").strip()
            if category_id and name:
                result.append({"category_id": category_id, "name": name, "parent_id": parent_id, "raw": raw})
            children = raw.get("children") or raw.get("subcategories") or []
            if isinstance(children, list):
                visit(children, category_id or parent_id)

    visit(categories)
    return result


def language_for(country: str) -> str:
    return {"cn": "zh", "jp": "ja"}.get(country.lower(), "en")
