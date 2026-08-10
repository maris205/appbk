import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from app_spider.api_client import language_for
from app_spider.config import Settings


class ConfigTests(unittest.TestCase):
    def test_language_for_country(self):
        self.assertEqual(language_for("cn"), "zh")
        self.assertEqual(language_for("jp"), "ja")
        self.assertEqual(language_for("us"), "en")

    def test_missing_key_is_rejected(self):
        with patch.dict(os.environ, {"RAPIDAPI_KEY": "", "APP_SPIDER_CONFIG": "/missing/config.yaml"}, clear=True):
            with self.assertRaisesRegex(ValueError, "RAPIDAPI_KEY"):
                Settings.load(require_mysql=False)

    def test_yaml_configuration(self):
        with tempfile.TemporaryDirectory() as directory:
            config = Path(directory) / "config.yaml"
            config.write_text(
                "rapidapi:\n  key: yaml-test-key\n"
                "mysql:\n  host: db.example\n  user: appbk\n  password: secret\n  database: appbk\n"
                "spider:\n  countries: [cn, us]\n  ranking_limit: 25\n",
                encoding="utf-8",
            )
            with patch.dict(os.environ, {"APP_SPIDER_CONFIG": str(config), "PYTHON_DOTENV_DISABLED": "1"}, clear=True):
                settings = Settings.load()
            self.assertEqual(settings.rapidapi_key, "yaml-test-key")
            self.assertEqual(settings.countries, ("cn", "us"))
            self.assertEqual(settings.ranking_limit, 25)


if __name__ == "__main__":
    unittest.main()
