from __future__ import annotations

from dataclasses import dataclass
import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
import yaml


def _read_yaml() -> dict[str, Any]:
    explicit = os.getenv("APP_SPIDER_CONFIG") or os.getenv("APPBK_CONFIG")
    candidates = [Path(explicit)] if explicit else [Path("../config.yaml"), Path("config.yaml")]
    path = next((candidate for candidate in candidates if candidate.exists()), None)
    if path is None:
        return {}
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    if not isinstance(data, dict):
        raise ValueError(f"配置文件 {path} 的根节点必须是对象")
    return data


def _section(config: dict[str, Any], name: str) -> dict[str, Any]:
    value = config.get(name, {})
    if not isinstance(value, dict):
        raise ValueError(f"配置项 {name} 必须是对象")
    return value


def _value(env_name: str, section: dict[str, Any], yaml_name: str, default: Any = "") -> Any:
    return os.getenv(env_name, section.get(yaml_name, default))


def _tuple(value: Any) -> tuple[str, ...]:
    if isinstance(value, list):
        return tuple(str(item).strip() for item in value if str(item).strip())
    return tuple(part.strip() for part in str(value).split(",") if part.strip())


def _bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    rapidapi_base_url: str
    rapidapi_host: str
    rapidapi_key: str
    timeout_seconds: float
    request_interval_ms: int
    monthly_budget: int
    mysql_host: str
    mysql_port: int
    mysql_user: str
    mysql_password: str
    mysql_database: str
    countries: tuple[str, ...]
    collections: tuple[str, ...]
    ranking_limit: int
    max_retries: int
    log_level: str
    log_file: str
    category_rankings_enabled: bool
    app_detail_ttl_hours: int
    review_ttl_hours: int
    review_top_n: int
    review_limit: int
    daily_request_limit: int
    monthly_request_limit: int
    budget_non_core_ratio: float
    usage_file: str

    @classmethod
    def load(cls, require_mysql: bool = True) -> "Settings":
        config = _read_yaml()
        if not config:
            load_dotenv()
        rapidapi = _section(config, "rapidapi")
        mysql = _section(config, "mysql")
        spider = _section(config, "spider")
        values = {
            "RAPIDAPI_KEY": _value("RAPIDAPI_KEY", rapidapi, "key"),
            "MYSQL_HOST": _value("MYSQL_HOST", mysql, "host"),
            "MYSQL_USER": _value("MYSQL_USER", mysql, "user"),
            "MYSQL_PASSWORD": _value("MYSQL_PASSWORD", mysql, "password"),
            "MYSQL_DATABASE": _value("MYSQL_DATABASE", mysql, "database"),
        }
        required = ["RAPIDAPI_KEY"] + (["MYSQL_HOST", "MYSQL_USER", "MYSQL_PASSWORD", "MYSQL_DATABASE"] if require_mysql else [])
        missing = [name for name in required if not values[name]]
        if missing:
            raise ValueError("缺少配置：" + ", ".join(missing))
        return cls(
            rapidapi_base_url=str(_value("RAPIDAPI_BASE_URL", rapidapi, "base_url", "https://app-store-google-play-data-api.p.rapidapi.com")).rstrip("/"),
            rapidapi_host=str(_value("RAPIDAPI_HOST", rapidapi, "host", "app-store-google-play-data-api.p.rapidapi.com")),
            rapidapi_key=str(values["RAPIDAPI_KEY"]),
            timeout_seconds=float(_value("RAPIDAPI_TIMEOUT_SECONDS", rapidapi, "timeout_seconds", 20)),
            request_interval_ms=int(_value("RAPIDAPI_REQUEST_INTERVAL_MS", rapidapi, "request_interval_ms", 300)),
            monthly_budget=int(_value("RAPIDAPI_MONTHLY_BUDGET", rapidapi, "monthly_budget", 30000)),
            mysql_host=str(values["MYSQL_HOST"]),
            mysql_port=int(_value("MYSQL_PORT", mysql, "port", 3306)),
            mysql_user=str(values["MYSQL_USER"]),
            mysql_password=str(values["MYSQL_PASSWORD"]),
            mysql_database=str(values["MYSQL_DATABASE"] or "appbk"),
            countries=_tuple(_value("SPIDER_COUNTRIES", spider, "countries", ["cn", "us", "jp"])),
            collections=_tuple(_value("SPIDER_COLLECTIONS", spider, "collections", ["topfreeapplications", "toppaidapplications", "topgrossingapplications"])),
            ranking_limit=min(max(int(_value("SPIDER_RANKING_LIMIT", spider, "ranking_limit", 100)), 1), 100),
            max_retries=max(int(_value("SPIDER_MAX_RETRIES", spider, "max_retries", 4)), 1),
            log_level=str(_value("SPIDER_LOG_LEVEL", spider, "log_level", "INFO")).upper(),
            log_file=str(_value("SPIDER_LOG_FILE", spider, "log_file", "logs/app_spider.log")),
            category_rankings_enabled=_bool(_value("SPIDER_CATEGORY_RANKINGS_ENABLED", spider, "category_rankings_enabled", True)),
            app_detail_ttl_hours=max(int(_value("SPIDER_APP_DETAIL_TTL_HOURS", spider, "app_detail_ttl_hours", 24)), 0),
            review_ttl_hours=max(int(_value("SPIDER_REVIEW_TTL_HOURS", spider, "review_ttl_hours", 24)), 0),
            review_top_n=min(max(int(_value("SPIDER_REVIEW_TOP_N", spider, "review_top_n", 20)), 1), 100),
            review_limit=min(max(int(_value("SPIDER_REVIEW_LIMIT", spider, "review_limit", 100)), 1), 500),
            daily_request_limit=max(int(_value("SPIDER_DAILY_REQUEST_LIMIT", spider, "daily_request_limit", 800)), 1),
            monthly_request_limit=max(int(_value("SPIDER_MONTHLY_REQUEST_LIMIT", spider, "monthly_request_limit", 24000)), 1),
            budget_non_core_ratio=min(max(float(_value("SPIDER_BUDGET_NON_CORE_RATIO", spider, "budget_non_core_ratio", 0.9)), 0.1), 1.0),
            usage_file=str(_value("SPIDER_USAGE_FILE", spider, "usage_file", "logs/rapidapi_usage.json")),
        )
