from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
import fcntl
import json
from pathlib import Path
from typing import Any

from .config import Settings


class BudgetExceeded(RuntimeError):
    pass


class NonCoreBudgetExceeded(BudgetExceeded):
    pass


@dataclass(frozen=True)
class UsageSnapshot:
    day: str
    month: str
    daily_requests: int
    monthly_requests: int
    daily_limit: int
    monthly_limit: int


class UsageLedger:
    def __init__(self, settings: Settings, path: str | Path | None = None):
        self.path = Path(path or settings.usage_file)
        self.daily_limit = settings.daily_request_limit
        self.monthly_limit = min(settings.monthly_request_limit, settings.monthly_budget)
        self.non_core_ratio = settings.budget_non_core_ratio

    @staticmethod
    def _keys(now: datetime | None = None) -> tuple[str, str]:
        current = now or datetime.now().astimezone()
        return current.strftime("%Y-%m-%d"), current.strftime("%Y-%m")

    @staticmethod
    def _read(handle: Any) -> dict[str, dict[str, int]]:
        handle.seek(0)
        raw = handle.read().strip()
        if not raw:
            return {"days": {}, "months": {}}
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            data = {}
        return {
            "days": {str(k): int(v) for k, v in dict(data.get("days") or {}).items()},
            "months": {str(k): int(v) for k, v in dict(data.get("months") or {}).items()},
        }

    @staticmethod
    def _write(handle: Any, data: dict[str, dict[str, int]]) -> None:
        handle.seek(0)
        handle.truncate()
        json.dump(data, handle, ensure_ascii=False, separators=(",", ":"))
        handle.flush()

    def _locked(self, callback: Any) -> Any:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.path.open("a+", encoding="utf-8") as handle:
            fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
            try:
                data = self._read(handle)
                result, changed = callback(data)
                if changed:
                    self._write(handle, data)
                return result
            finally:
                fcntl.flock(handle.fileno(), fcntl.LOCK_UN)

    def consume(self, essential: bool = False, now: datetime | None = None) -> UsageSnapshot:
        day, month = self._keys(now)

        def operation(data: dict[str, dict[str, int]]) -> tuple[UsageSnapshot, bool]:
            daily = data["days"].get(day, 0)
            monthly = data["months"].get(month, 0)
            if daily >= self.daily_limit or monthly >= self.monthly_limit:
                raise BudgetExceeded(f"RapidAPI 硬预算已用尽：day={daily}/{self.daily_limit}, month={monthly}/{self.monthly_limit}")
            if not essential and (
                daily >= int(self.daily_limit * self.non_core_ratio)
                or monthly >= int(self.monthly_limit * self.non_core_ratio)
            ):
                raise NonCoreBudgetExceeded(f"RapidAPI 已达到非核心任务阈值：day={daily}, month={monthly}")
            daily += 1
            monthly += 1
            data["days"] = {k: v for k, v in data["days"].items() if k >= day[:7] + "-01"}
            data["months"] = {k: v for k, v in data["months"].items() if k >= month}
            data["days"][day] = daily
            data["months"][month] = monthly
            return UsageSnapshot(day, month, daily, monthly, self.daily_limit, self.monthly_limit), True

        return self._locked(operation)

    def snapshot(self, now: datetime | None = None) -> UsageSnapshot:
        day, month = self._keys(now)

        def operation(data: dict[str, dict[str, int]]) -> tuple[UsageSnapshot, bool]:
            return UsageSnapshot(
                day,
                month,
                data["days"].get(day, 0),
                data["months"].get(month, 0),
                self.daily_limit,
                self.monthly_limit,
            ), False

        return self._locked(operation)
