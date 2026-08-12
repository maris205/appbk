# appbk spider

appbk 的开源 iOS 公共数据采集器。V2 持续采集分类、总榜与分类榜、App 详情快照和优先 App 评论，并写入 appbk MySQL。

## 安装

```bash
cd app_spider
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp ../config.yaml.example ../config.yaml
```

编辑项目根目录的 `config.yaml`，填写 RapidAPI、MySQL 和 AI 配置。Web 与爬虫共用该文件，文件已被忽略，不会上传 Git。`APPBK_CONFIG` 或环境变量仍可覆盖默认位置和 YAML 配置。

## 使用

```bash
# 验证接口和解析，不写数据库
python -m app_spider categories --country cn
python -m app_spider sync-categories --country cn --dry-run
python -m app_spider rankings --country cn --collection topfreeapplications --limit 10 --dry-run
python -m app_spider app-detail --app-id 414478124 --country cn --dry-run
python -m app_spider reviews --app-id 414478124 --country cn --limit 10 --dry-run

# 单项入库
python -m app_spider sync-categories --country cn
python -m app_spider rankings --country cn --collection topfreeapplications --limit 100
python -m app_spider app-detail --app-id 414478124 --country cn
python -m app_spider reviews --app-id 414478124 --country cn --limit 100

# 每 6 小时采集三个市场总榜
python -m app_spider run-daily

# 每天采集分类、分类榜、优先评论和 TTL 到期的详情
python -m app_spider run-public-daily
```

首次部署建议先执行 dry-run，再采集 10 条，确认后运行 `run-daily`。

## cron 示例

```cron
10 2,8,14,20 * * * cd /opt/appbk/app_spider && /usr/bin/flock -n /tmp/app_spider_rankings.lock .venv/bin/python -m app_spider run-daily >> logs/cron.log 2>&1
40 3 * * * cd /opt/appbk/app_spider && /usr/bin/flock -n /tmp/app_spider_public.lock .venv/bin/python -m app_spider run-public-daily >> logs/cron.log 2>&1
```

## 数据规则

- `apps.apple_id` 负责 App 去重。
- 一次榜单请求的全部记录使用相同 `fetched_at`。
- 榜单批次共享同一个 `fetched_at`；单条脏数据只跳过自身。
- App 详情按 `app_id + country` 使用 24 小时 TTL，`--force` 可绕过。
- 评论按 `(provider_id, country)` upsert，重复运行不会重复插入。
- 上游详情完整保存在 `app_snapshots.raw_json`，常用字段同时结构化。
- `logs/rapidapi_usage.json` 记录日/月请求量；90% 后停止非核心任务，硬上限默认 800/日、24,000/月。
- 不读取或修改用户、登录 Session 和 Agent 洞察数据。
