import os
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
        with patch.dict(os.environ, {"RAPIDAPI_KEY": ""}, clear=True):
            with self.assertRaisesRegex(ValueError, "RAPIDAPI_KEY"):
                Settings.load(require_mysql=False)


if __name__ == "__main__":
    unittest.main()
