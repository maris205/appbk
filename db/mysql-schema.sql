CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(254) NOT NULL,
  password_hash VARCHAR(128) NOT NULL,
  password_salt VARCHAR(128) NOT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY idx_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  token_hash VARCHAR(128) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  created_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY idx_sessions_token_hash (token_hash),
  KEY idx_sessions_user_id (user_id),
  KEY idx_sessions_expires_at (expires_at),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS apps (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  apple_id VARCHAR(32) NOT NULL,
  name VARCHAR(512) NOT NULL,
  developer VARCHAR(512),
  icon_url TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY idx_apps_apple_id (apple_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS app_snapshots (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  app_id BIGINT UNSIGNED NOT NULL,
  country VARCHAR(8) NOT NULL,
  version VARCHAR(64),
  price DECIMAL(12,4),
  rating DECIMAL(8,5),
  rating_count BIGINT,
  raw_json LONGTEXT,
  fetched_at BIGINT NOT NULL,
  PRIMARY KEY (id),
  KEY idx_app_snapshots_app_country_time (app_id, country, fetched_at),
  CONSTRAINT fk_app_snapshots_app FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ranking_snapshots (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  app_id BIGINT UNSIGNED NOT NULL,
  country VARCHAR(8) NOT NULL,
  category VARCHAR(64) NOT NULL,
  collection VARCHAR(64) NOT NULL,
  `rank` INT NOT NULL,
  fetched_at BIGINT NOT NULL,
  PRIMARY KEY (id),
  KEY idx_rankings_market_time (country, category, collection, fetched_at),
  CONSTRAINT fk_ranking_snapshots_app FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reviews (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  provider_id VARCHAR(128) NOT NULL,
  app_id BIGINT UNSIGNED NOT NULL,
  country VARCHAR(8) NOT NULL,
  rating TINYINT NOT NULL,
  title TEXT,
  body LONGTEXT NOT NULL,
  author VARCHAR(512),
  app_version VARCHAR(64),
  published_at BIGINT NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY idx_reviews_provider_country (provider_id, country),
  KEY idx_reviews_app_country_time (app_id, country, published_at),
  CONSTRAINT fk_reviews_app FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS keywords (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  keyword VARCHAR(512) NOT NULL,
  country VARCHAR(8) NOT NULL,
  language VARCHAR(16) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY idx_keywords_keyword_country (keyword, country)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS keyword_ranking_snapshots (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  keyword_id BIGINT UNSIGNED NOT NULL,
  app_id BIGINT UNSIGNED NOT NULL,
  `rank` INT NOT NULL,
  fetched_at BIGINT NOT NULL,
  PRIMARY KEY (id),
  KEY idx_keyword_rankings_keyword_time (keyword_id, fetched_at),
  CONSTRAINT fk_keyword_rankings_keyword FOREIGN KEY (keyword_id) REFERENCES keywords(id) ON DELETE CASCADE,
  CONSTRAINT fk_keyword_rankings_app FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS insights (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  type VARCHAR(64) NOT NULL,
  title VARCHAR(512) NOT NULL,
  conclusion LONGTEXT NOT NULL,
  recommendation LONGTEXT,
  evidence_json LONGTEXT NOT NULL,
  confidence VARCHAR(16) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  app_id BIGINT UNSIGNED,
  keyword_id BIGINT UNSIGNED,
  generated_at BIGINT NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_insights_app FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE SET NULL,
  CONSTRAINT fk_insights_keyword FOREIGN KEY (keyword_id) REFERENCES keywords(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
