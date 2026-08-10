# appbk spider

appbk 的开源 iOS 公共数据采集器。它从 RapidAPI 获取 App Store 分类和榜单，将标准化结果写入 appbk MySQL。

## 安装

```bash
cd app_spider
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

编辑 `.env` 填写 RapidAPI 和 MySQL 配置。`.env` 已被忽略，不会上传 Git。

## 使用

```bash
# 验证接口和解析，不写数据库
python -m app_spider categories --country cn
python -m app_spider rankings --country cn --collection topfreeapplications --limit 10 --dry-run

# 采集单个榜单并入库
python -m app_spider rankings --country cn --collection topfreeapplications --limit 100

# 依次采集配置中的国家和三种榜单
python -m app_spider run-daily
```

首次部署建议先执行 dry-run，再采集 10 条，确认后运行 `run-daily`。

## cron 示例

```cron
10 2,8,14,20 * * * cd /opt/app_spider && .venv/bin/python -m app_spider run-daily >> logs/cron.log 2>&1
```

## 数据规则

- `apps.apple_id` 负责 App 去重。
- 一次榜单请求的全部记录使用相同 `fetched_at`。
- App 与榜单快照在同一个 MySQL 事务中写入。
- 上游响应保存在 `app_snapshots.raw_json`，便于后续补充字段。
- 不读取或修改用户、登录 Session 和 Agent 洞察数据。

