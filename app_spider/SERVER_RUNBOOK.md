# app_spider 服务器运行说明

本文以 Ubuntu/Debian、项目目录 `/opt/appbk` 为例。其他 Linux 发行版只需调整软件安装命令。

## 1. 准备服务器

```bash
sudo apt update
sudo apt install -y git python3 python3-venv python3-pip
```

确认服务器能够访问 RapidAPI 和 appbk MySQL。MySQL/RDS 的白名单需要包含服务器公网 IP。

## 2. 使用 SSH 拉取代码

服务器需要有可访问仓库的 SSH Key，并将公钥添加到 GitHub：

```bash
sudo mkdir -p /opt
sudo chown "$USER":"$USER" /opt
cd /opt
git clone git@github.com:maris205/appbk.git
cd /opt/appbk/app_spider
```

以后更新代码：

```bash
cd /opt/appbk
git pull --ff-only origin main
```

## 3. 安装 Python 环境

```bash
cd /opt/appbk/app_spider
python3 -m venv .venv
.venv/bin/pip install --upgrade pip
.venv/bin/pip install -r requirements.txt
mkdir -p logs
```

## 4. 上传配置文件

Web 与爬虫统一使用项目根目录 `/opt/appbk/config.yaml`。先在服务器生成：

```bash
cd /opt/appbk
cp config.yaml.example config.yaml
chmod 600 config.yaml
nano config.yaml
```

也可以在本机准备好后上传：

```bash
scp /Users/maris/appbk/config.yaml SERVER_USER@SERVER_IP:/opt/appbk/config.yaml
```

将 `SERVER_USER` 和 `SERVER_IP` 替换成实际服务器账号和地址。在服务器检查权限，不要打印文件内容：

```bash
cd /opt/appbk
chmod 600 config.yaml
test -s config.yaml && echo "配置文件存在"
```

配置文件需要这些字段：

YAML 的完整格式见项目根目录的 `config.yaml.example`，包括 RapidAPI、MySQL、AI 和采集参数四个分组。

不要把 `config.yaml` 添加到 Git，也不要在日志或截图中展示其内容。环境变量可覆盖 YAML 配置，适合以后通过 Docker 或 CI 注入密码。

## 5. 首次测试

先验证 RapidAPI，不写数据库：

```bash
cd /opt/appbk/app_spider
.venv/bin/python -m app_spider rankings \
  --country cn \
  --collection topfreeapplications \
  --limit 10 \
  --dry-run
```

预期结果包含：

```text
"received": 10
"written": 0
"dry_run": true
```

然后执行小规模真实入库：

```bash
.venv/bin/python -m app_spider rankings \
  --country cn \
  --collection topfreeapplications \
  --limit 10
```

预期 `written` 为 10。若连接 MySQL 失败，先检查 RDS 白名单、安全组、账号权限和 3306 端口。

## 6. 正式手动运行

采集 `.env` 中配置的全部国家和榜单：

```bash
cd /opt/appbk/app_spider
.venv/bin/python -m app_spider run-daily
```

查看最近日志：

```bash
tail -n 100 /opt/appbk/app_spider/logs/app_spider.log
```

## 7. 配置定时任务

编辑当前用户的 cron：

```bash
crontab -e
```

每天北京时间 02:10、08:10、14:10、20:10 执行：

```cron
CRON_TZ=Asia/Shanghai
10 2,8,14,20 * * * cd /opt/appbk/app_spider && /usr/bin/flock -n /tmp/app_spider_daily.lock .venv/bin/python -m app_spider run-daily >> logs/cron.log 2>&1
```

`flock` 会防止上一轮没有结束时重复启动。首次建议只设置每天一次，观察 API 用量和数据库增长后再改成每天四次。

检查 cron：

```bash
crontab -l
tail -n 100 /opt/appbk/app_spider/logs/cron.log
```

## 8. 停止与更新

爬虫不是常驻服务，每次任务执行完成后自动退出。临时停止定时采集，只需在 `crontab -e` 中注释或删除对应行。

更新步骤：

```bash
cd /opt/appbk
git pull --ff-only origin main
cd app_spider
.venv/bin/pip install -r requirements.txt
.venv/bin/python -m unittest discover -s tests -v
```

`config.yaml` 不受 Git 更新影响。

## 9. 常见问题

- `Access denied`：MySQL 用户名、密码或数据库权限错误。
- `Can't connect`：RDS 白名单、安全组或端口问题。
- HTTP 401/403：RapidAPI Key 或订阅状态错误。
- HTTP 429：套餐额度或请求频率达到限制，降低定时频率。
- GitHub SSH 失败：检查服务器 SSH 公钥是否已添加到 GitHub。
- cron 能手动运行但定时失败：必须使用本文中的绝对路径，并检查 `logs/cron.log`。
