# appbk

大模型时代的 App 决策服务。项目包含 Next.js Web、MySQL 数据层、模型 Data Tools 和独立的 App Store 公共数据采集器。

## 目录

- `app/`、`components/`：网站和聊天 Agent
- `lib/app-data-tools.ts`：受控 MySQL 数据工具
- `app_spider/`：RapidAPI 榜单采集器
- `db/mysql-schema.sql`：MySQL 表结构
- `config.yaml.example`：Web 与爬虫共用的配置模板
- `WEB_DEPLOY.md`：Web 部署说明
- `app_spider/SERVER_RUNBOOK.md`：爬虫部署说明

## 环境要求

- Node.js 22.13+
- Python 3.11+
- MySQL 8 或兼容的阿里云 RDS MySQL

## 统一配置

```bash
cp config.yaml.example config.yaml
chmod 600 config.yaml
```

填写以下四个分组：

- `rapidapi`
- `mysql`
- `ai`
- `spider`

`config.yaml` 已被 Git 忽略。Web 和爬虫优先读取这一份配置；系统环境变量仍可覆盖对应字段。

## Web

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run build
npm run start
```

三个命令都会先通过 `scripts/next-with-config.mjs` 加载根目录 `config.yaml`。

## 爬虫

```bash
cd app_spider
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python -m app_spider rankings --country cn --collection topfreeapplications --limit 10 --dry-run
.venv/bin/python -m app_spider run-daily
```

从 `app_spider` 目录运行时，爬虫自动读取上一级目录的 `config.yaml`。也可以用 `APPBK_CONFIG=/path/to/config.yaml` 指定位置。

## 测试

```bash
npm run build
cd app_spider && .venv/bin/python -m unittest discover -s tests -v
```

## 部署更新

```bash
cd /opt/appbk
git pull --ff-only origin main
npm install
npm run build
sudo systemctl restart appbk-web
```

`git pull` 不会覆盖 `config.yaml`。
