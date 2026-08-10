from __future__ import annotations

import time
from typing import Any

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from .config import Settings


class RetryableApiError(RuntimeError):
    pass


class ApiClient:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.request_count = 0
        self._last_request_at = 0.0
        self._client = httpx.Client(
            base_url=settings.rapidapi_base_url,
            timeout=settings.timeout_seconds,
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

    def _request_once(self, path: str, params: dict[str, Any]) -> dict[str, Any]:
        self._throttle()
        response = self._client.get(path, params=params)
        self._last_request_at = time.monotonic()
        self.request_count += 1
        if response.status_code in {429, 500, 502, 503, 504}:
            raise RetryableApiError(f"上游暂时失败：HTTP {response.status_code}")
        response.raise_for_status()
        payload = response.json()
        if not payload.get("success", False):
            raise RuntimeError(str(payload.get("message") or "上游返回失败"))
        return payload

    def get(self, path: str, params: dict[str, Any]) -> dict[str, Any]:
        call = retry(
            retry=retry_if_exception_type((RetryableApiError, httpx.TimeoutException, httpx.NetworkError)),
            stop=stop_after_attempt(self.settings.max_retries),
            wait=wait_exponential(multiplier=1, min=1, max=10),
            reraise=True,
        )(self._request_once)
        return call(path, params)

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
        payload = self.get(f"/ios/top/{collection}", params)
        data = payload.get("data")
        if not isinstance(data, list):
            raise RuntimeError("榜单接口 data 不是数组")
        return data


def language_for(country: str) -> str:
    return {"cn": "zh", "jp": "ja"}.get(country.lower(), "en")

