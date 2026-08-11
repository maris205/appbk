# appbk Web 简易部署说明

本文以 Ubuntu/Debian、项目目录 `/opt/appbk`、域名 `appbk.com` 为例。Web 是标准 Next.js Node 服务，默认监听 `3000` 端口。

## 1. 拉取代码

如果服务器还没有项目：

```bash
sudo mkdir -p /opt
sudo chown "$USER":"$USER" /opt
cd /opt
git clone git@github.com:maris205/appbk.git
```

如果爬虫已经 clone 过项目：

```bash
cd /opt/appbk
git pull --ff-only origin main
```

## 2. 安装 Node.js

要求 Node.js 22 或更高版本。推荐使用 nvm：

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc
nvm install 22
nvm use 22
node -v
npm -v
```

## 3. 上传 Web 配置

在本机 Mac 执行：

```bash
scp /Users/maris/appbk/.env.local \
  SERVER_USER@SERVER_IP:/opt/appbk/.env.local
```

服务器设置权限：

```bash
cd /opt/appbk
chmod 600 .env.local
test -s .env.local && echo "Web 配置存在"
```

`.env.local` 应包含：

- `RAPIDAPI_KEY`、`RAPIDAPI_HOST`
- `AI_API_KEY`、`AI_BASE_URL`、`AI_MODEL`
- `MYSQL_HOST`、`MYSQL_PORT`、`MYSQL_USER`、`MYSQL_PASSWORD`、`MYSQL_DATABASE`

该文件已被 Git 忽略，禁止提交或打印其内容。正式上线前应更换曾经公开过的测试 Key 和数据库密码。

## 4. 安装、构建和试运行

```bash
cd /opt/appbk
npm install
npm run build
npm run start
```

另开一个终端测试：

```bash
curl -I http://127.0.0.1:3000/
curl -I http://127.0.0.1:3000/rankings
```

返回 `200` 后按 `Ctrl+C` 停止试运行。

## 5. 使用 systemd 常驻

确认 Node 路径：

```bash
which node
which npm
whoami
```

创建服务：

```bash
sudo nano /etc/systemd/system/appbk-web.service
```

写入以下内容，并将 `SERVER_USER`、`NODE_BIN_DIR` 替换为实际值。`NODE_BIN_DIR` 是 `which node` 结果去掉末尾 `/node` 后的目录。

```ini
[Unit]
Description=appbk Next.js Web
After=network.target

[Service]
Type=simple
User=SERVER_USER
WorkingDirectory=/opt/appbk
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=PATH=NODE_BIN_DIR:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin
ExecStart=NODE_BIN_DIR/npm run start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

启动：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now appbk-web
sudo systemctl status appbk-web --no-pager
```

查看日志：

```bash
journalctl -u appbk-web -n 100 --no-pager
journalctl -u appbk-web -f
```

## 6. 配置 Nginx

```bash
sudo apt update
sudo apt install -y nginx
sudo nano /etc/nginx/sites-available/appbk
```

写入：

```nginx
server {
    listen 80;
    server_name appbk.com www.appbk.com;

    client_max_body_size 10m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 180s;
    }
}
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/appbk /etc/nginx/sites-enabled/appbk
sudo nginx -t
sudo systemctl reload nginx
```

将 `appbk.com` 和 `www.appbk.com` 的 DNS A 记录指向服务器公网 IP。

## 7. 配置 HTTPS

DNS 生效后执行：

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d appbk.com -d www.appbk.com
```

检查自动续期：

```bash
sudo certbot renew --dry-run
```

## 8. 后续更新发布

```bash
cd /opt/appbk
git pull --ff-only origin main
npm install
npm run build
sudo systemctl restart appbk-web
sudo systemctl status appbk-web --no-pager
```

`git pull` 不会覆盖 `.env.local` 和 `app_spider/config.yaml`。

## 9. 最终检查

```bash
curl -I https://appbk.com/
curl -I https://appbk.com/rankings
sudo systemctl status appbk-web --no-pager
```

然后在浏览器完成一次注册、登录和数据库榜单问答，确认 MySQL、RapidAPI 和大模型三条链路均正常。
