# app_spider V2：RapidAPI 公共数据补全

## 1. 目标

把当前 RapidAPI 能稳定提供的 iOS 公共数据持续写入 appbk MySQL，为榜单、App 详情、评分评论和后续 Agent Tools 提供统一数据源。

本版本只做公共市场数据，不做 ASO 关键词和 Apple Ads 用户数据。

## 2. 当前状态

- 已支持 `GET /ios/categories`，但分类尚未持久化。
- 已支持 `GET /ios/top/{collection}`，并写入 `apps`、`app_snapshots`、`ranking_snapshots`。
- Web 会直接请求 App 详情和评论，但爬虫没有持续采集，Agent 也无法从 MySQL 查询评论。
- 当前市场为 `cn`、`us`、`jp`，榜单为免费榜、付费榜和畅销榜。

## 3. V2 数据范围

### 3.1 分类

采集三个市场的 iOS 分类并持久化，至少保存：

- `country`
- `category_id`
- `name`
- `parent_id`（上游存在时）
- `fetched_at`

唯一键为 `(country, category_id)`，重复采集采用 upsert。

### 3.2 榜单

继续采集三个市场的：

- `topfreeapplications`
- `toppaidapplications`
- `topgrossingapplications`

同时覆盖：

- 总榜 `category=all`
- 各分类榜
- 每榜最多 100 条

同一次榜单请求的所有记录必须共用同一个 `fetched_at`，确保可以正确比较批次。

### 3.3 App 详情快照

对榜单中出现的新 App 或详情超过 24 小时未更新的 App，调用详情接口并写入 `app_snapshots`。除现有字段外，应在 `raw_json` 中完整保留上游响应，并尽量结构化保存：

- Apple ID、Bundle ID、名称、开发者
- 描述、版本更新说明
- 分类、主分类
- 当前版本、价格、币种
- 评分、评分数
- 内容分级、最低系统版本、文件大小
- 发布时间、当前版本发布时间
- 图标、截图、商店 URL

同一个 `app_id + country` 在 24 小时内不重复请求详情，除非使用命令行强制刷新。

### 3.4 评论

对优先 App 采集最新评论并写入现有 `reviews` 表：

- `provider_id`
- `app_id`
- `country`
- `rating`
- `title`
- `body`
- `author`
- `app_version`
- `published_at`

使用 `(provider_id, country)` 去重并 upsert；单个 App 一次建议拉取最近 100 条，支持分页。首版优先采集每个市场免费总榜和畅销总榜前 20 名，不全量抓取所有分类 App 的评论。

## 4. 调用预算

按 RapidAPI 30,000 次/月套餐设计，目标使用不超过 24,000 次/月，保留至少 20% 余量。

建议默认调度：

- 总榜：每 6 小时一次，约 1,080 次/月。
- 分类榜：每天一次，按 20 个分类估算约 5,400 次/月。
- App 详情：新 App 立即采集，旧 App 每 24 小时最多一次，设置每日硬上限。
- 评论：每天一次，只处理每个市场免费榜和畅销榜前 20 名，设置每日硬上限。

API 客户端应统计当次请求数；增加按天和按月的本地用量记录。达到配置预算的 90% 时停止非核心任务，但总榜仍允许运行。

## 5. CLI

保留现有命令，并增加：

```bash
python -m app_spider sync-categories --country cn
python -m app_spider rankings --country cn --collection topfreeapplications --category all --limit 100
python -m app_spider app-detail --app-id 123456789 --country cn
python -m app_spider reviews --app-id 123456789 --country cn --limit 100
python -m app_spider run-public-daily
```

所有写数据库的命令继续支持 `--dry-run`；详情和评论命令增加 `--force`。

## 6. 配置

继续使用项目根目录 `config.yaml`，在 `spider` 下兼容增加：

```yaml
spider:
  countries: [cn, us, jp]
  collections:
    - topfreeapplications
    - toppaidapplications
    - topgrossingapplications
  ranking_limit: 100
  category_rankings_enabled: true
  app_detail_ttl_hours: 24
  review_top_n: 20
  review_limit: 100
  daily_request_limit: 800
  monthly_request_limit: 24000
```

不得把真实 RapidAPI Key 或 MySQL 密码提交到 Git。

## 7. 数据质量要求

- 上游单条脏数据不能导致整批榜单回滚；记录错误并跳过该条。
- 请求失败需要指数退避；401/403 不重试，429 和 5xx 可重试。
- 时间统一存 Unix 毫秒，展示时再转换时区。
- 每个任务输出 received、inserted、updated、skipped、failed、requests 和 duration_ms。
- 保存原始 JSON，便于后续字段升级和排查数据口径。

## 8. 验收标准

- `cn`、`us`、`jp` 分类可在 MySQL 查询。
- 三个市场的三类总榜各有最新 100 条快照。
- 任意榜单 App 可以查询最新详情快照。
- 优先 App 可以查询最近评论，重复运行不会产生重复评论。
- 连续两个榜单批次可以正确计算新上榜、上升和下降。
- dry-run 不写数据库，但会真实验证 RapidAPI 响应格式。
- 自动化测试覆盖分页、去重、TTL、预算停止和单条脏数据跳过。

## 9. 后续版本（不属于本次）

V3 再做两类关键词数据：

1. 公共自然搜索关键词：关键词搜索结果、App 自然排名及排名历史。
2. 用户 Apple Ads 数据：Campaign、Ad Group、投放关键词、Search Term、花费、安装和转化。

两者数据来源、权限和口径不同，不应混在同一张表或同一个采集任务中。
