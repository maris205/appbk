from __future__ import annotations

from dataclasses import dataclass
import os

from dotenv import load_dotenv


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

    @classmethod
    def load(cls, require_mysql: bool = True) -> "Settings":
        load_dotenv()
        required = ["RAPIDAPI_KEY"]
        if require_mysql:
            required += ["MYSQL_HOST", "MYSQL_USER", "MYSQL_PASSWORD", "MYSQL_DATABASE"]
        missing = [name for name in required if not os.getenv(name)]
        if missing:
            raise ValueError("缺少配置：" + ", ".join(missing))
        return cls(
            rapidapi_base_url=os.getenv("RAPIDAPI_BASE_URL", "https://app-store-google-play-data-api.p.rapidapi.com").rstrip("/"),
            rapidapi_host=os.getenv("RAPIDAPI_HOST", "app-store-google-play-data-api.p.rapidapi.com"),
            rapidapi_key=os.getenv("RAPIDAPI_KEY", ""),
            timeout_seconds=float(os.getenv("RAPIDAPI_TIMEOUT_SECONDS", "20")),
            request_interval_ms=int(os.getenv("RAPIDAPI_REQUEST_INTERVAL_MS", "300")),
            monthly_budget=int(os.getenv("RAPIDAPI_MONTHLY_BUDGET", "30000")),
            mysql_host=os.getenv("MYSQL_HOST", ""),
            mysql_port=int(os.getenv("MYSQL_PORT", "3306")),
            mysql_user=os.getenv("MYSQL_USER", ""),
            mysql_password=os.getenv("MYSQL_PASSWORD", ""),
            mysql_database=os.getenv("MYSQL_DATABASE", "appbk"),
            countries=tuple(filter(None, os.getenv("SPIDER_COUNTRIES", "cn,us").split(","))),
            collections=tuple(filter(None, os.getenv("SPIDER_COLLECTIONS", "topfreeapplications,toppaidapplications,topgrossingapplications").split(","))),
            ranking_limit=min(max(int(os.getenv("SPIDER_RANKING_LIMIT", "100")), 1), 100),
            max_retries=max(int(os.getenv("SPIDER_MAX_RETRIES", "4")), 1),
            log_level=os.getenv("SPIDER_LOG_LEVEL", "INFO").upper(),
            log_file=os.getenv("SPIDER_LOG_FILE", "logs/app_spider.log"),
        )

