# app_spider MVP1 需求与概要设计

## 1. 目标

在远程服务器运行一个独立的数据采集服务，通过 RapidAPI 的 `App Store & Google Play Data API` 定时采集 iOS 公共数据，并直接写入 appbk 的 MySQL 数据库，供 appbk.com 的榜单、App 详情和后续 Agent 使用。

爬虫与网站代码解耦：爬虫只负责采集、标准化和入库；网站只读数据库并进行展示和分析。

## 2. MVP1 范围

第一版只做 iOS，暂不做 Google Play、逆向抓取、代理池和分布式任务。

### 必须完成

1. 拉取 App Store 分类列表。
2. 拉取中国区和美国区榜单。
3. 榜单类型：免费榜、付费榜、畅销榜；以 API 实际支持的 collection 参数为准。
4. 拉取榜单内 App 的基础详情并保存快照。
5. 支持按 App 拉取最新评论；如果当前套餐/API 不提供评论接口，保留任务接口并记录跳过原因。
6. 所有任务可通过命令行手动运行，也可由 cron 定时运行。
7. 失败自动重试，并保存结构化日志和本次任务统计。

### 暂不完成

- 关键词排名与广告关键词。
- Apple Search Ads 用户账户数据。
- Web 管理后台。
- 消息队列、分布式调度与代理池。
- 大模型分析；大模型由 appbk 网站侧完成。

## 3. 推荐技术栈

- Python 3.11+
- `httpx`：HTTP 请求
- `SQLAlchemy 2.x` + `PyMySQL`：MySQL
- `tenacity`：指数退避重试
- `python-dotenv`：本地配置
- `pytest`：测试
- Linux cron：定时调度

项目名称和目录建议为 `app_spider`。

## 4. 命令行

至少实现以下命令：

```bash
python -m app_spider categories --country cn
python -m app_spider rankings --country cn
python -m app_spider rankings --country us
python -m app_spider app-details --country cn --from-latest-ranking
python -m app_spider reviews --country cn --from-latest-ranking
python -m app_spider run-daily
```

增加 `--dry-run` 参数：请求和解析数据，但不写数据库。

## 5. 调度策略

- 中国区全分类榜单：每天 4 次（02:10、08:10、14:10、20:10）。
- 美国区全分类榜单：每天 2 次（04:10、16:10）。
- App 详情：每天一次，仅更新最近 7 天进入过榜单的 App。
- 评论：每天一次，每个 App 最多获取最近 50 条。
- 首次运行先只抓总榜，确认数据后再开启全分类。

任务必须使用文件锁或数据库锁，防止同一任务并发重复执行。

## 6. 数据库写入规则

直接复用 appbk 已有表结构，建表 SQL 从网站项目的 `db/mysql-schema.sql` 复制到本项目，不自行修改字段含义。

### apps

- 以 `apple_id` 为唯一键。
- 使用 `INSERT ... ON DUPLICATE KEY UPDATE` 更新名称、开发者、图标和 `updated_at`。
- 时间统一保存为 Unix 毫秒时间戳。

### ranking_snapshots

- 每次成功采集生成一批榜单快照。
- 写入 `app_id`、`country`、`category`、`collection`、`rank`、`fetched_at`。
- 同一次请求的所有记录使用完全相同的 `fetched_at`。
- 只有整页解析成功后才开启事务写入，避免留下半张榜单。

### app_snapshots

- 保存国家、版本、价格、评分、评分数、抓取时间。
- `raw_json` 保存原始 App 对象，便于以后补字段，无需重新请求。

### reviews

- 以 API 返回的评论 ID 作为 `provider_id`。
- `(provider_id, country)` 唯一，重复评论执行 upsert 或忽略。
- 评论发布时间转换为 Unix 毫秒。

爬虫不得写入 `users`、`sessions` 和 `insights`。

## 7. RapidAPI 请求规范

- Host：`app-store-google-play-data-api.p.rapidapi.com`
- 所有 URL 和 key 从环境变量读取，禁止写死在源码。
- 默认超时 20 秒。
- 429、500、502、503、504 使用指数退避重试，最多 4 次。
- 401、403 不重试，立即失败并打印明确错误。
- 请求间隔由 `RAPIDAPI_REQUEST_INTERVAL_MS` 控制，默认 300ms。
- 记录调用次数；达到 `RAPIDAPI_MONTHLY_BUDGET` 的 80% 时输出警告，达到上限后停止非必要任务。
- 日志中禁止打印 RapidAPI key、数据库密码或完整连接串。

榜单接口示例：

```text
GET /ios/top/{collection}?lang=zh&limit=100&offset=0&country=cn&category={category}
```

分类接口示例：

```text
GET /ios/categories?lang=zh&country=cn
```

collection 和 category 必须先通过真实接口验证，不能把 `{collection}`、`{}` 等占位符直接发送到生产任务。

## 8. 日志与任务结果

日志写到 `logs/app_spider.log`，同时输出到 stdout，便于 systemd/cron 收集。每次任务至少记录：

- task、country、category、collection
- started_at、finished_at、duration_ms
- API 请求数、成功数、重试数
- 解析 App 数、插入快照数、跳过数
- 脱敏后的错误类型与响应状态码

进程退出码：成功为 0；有任一必要任务失败为非 0。

## 9. 目录结构

```text
app_spider/
  app_spider/
    __main__.py
    config.py
    api_client.py
    models.py
    repository.py
    tasks/
      categories.py
      rankings.py
      app_details.py
      reviews.py
  sql/mysql-schema.sql
  tests/
  logs/
  .env.example
  requirements.txt
  README.md
```

## 10. 验收标准

1. `categories` 能读取并打印中国区分类。
2. `rankings --country cn` 能采集至少一个榜单，榜单名次连续且首名为 1。
3. 重复运行不会生成重复的 App 主记录。
4. MySQL 中 `apps`、`ranking_snapshots` 和 `app_snapshots` 数量按预期增加。
5. 任意一页 API 失败不会写入残缺榜单。
6. 日志和 Git 中不出现真实 key 或数据库密码。
7. 至少包含 API 响应解析、upsert 和失败重试的自动测试。

## 11. 给远程 Codex 的执行指令

请在当前 `app_spider` 项目中按本文档实现 MVP1。先完成目录、配置校验、MySQL 连接、分类和榜单任务，再实现 App 详情与评论。使用 `.env` 加载密钥，不要将真实密钥提交到 Git。完成后运行测试，并使用中国区总榜做一次小规模真实采集，汇报请求数、入库数和失败数。
