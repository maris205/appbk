import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";

const command = process.argv[2];
if (!new Set(["dev", "build", "start"]).has(command)) {
  console.error("用法：node scripts/next-with-config.mjs <dev|build|start>");
  process.exit(2);
}

const configPath = resolve(process.env.APPBK_CONFIG || "config.yaml");
if (existsSync(configPath)) {
  const config = parse(readFileSync(configPath, "utf8")) || {};
  const rapidapi = config.rapidapi || {};
  const mysql = config.mysql || {};
  const ai = config.ai || {};
  const mapped = {
    RAPIDAPI_BASE_URL: rapidapi.base_url,
    RAPIDAPI_HOST: rapidapi.host,
    RAPIDAPI_KEY: rapidapi.key,
    RAPIDAPI_TIMEOUT_SECONDS: rapidapi.timeout_seconds,
    RAPIDAPI_REQUEST_INTERVAL_MS: rapidapi.request_interval_ms,
    RAPIDAPI_MONTHLY_BUDGET: rapidapi.monthly_budget,
    MYSQL_HOST: mysql.host,
    MYSQL_PORT: mysql.port,
    MYSQL_USER: mysql.user,
    MYSQL_PASSWORD: mysql.password,
    MYSQL_DATABASE: mysql.database,
    AI_API_KEY: ai.api_key,
    AI_BASE_URL: ai.base_url,
    AI_MODEL: ai.model,
  };
  for (const [key, value] of Object.entries(mapped)) {
    if (process.env[key] === undefined && value !== undefined && value !== null) process.env[key] = String(value);
  }
  console.log(`已加载配置：${configPath}`);
} else {
  console.log(`未找到 ${configPath}，使用环境变量或 Next.js .env 文件`);
}

const nextBin = resolve("node_modules/next/dist/bin/next");
const child = spawn(process.execPath, [nextBin, command, ...process.argv.slice(3)], {
  env: process.env,
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error(error.message);
  process.exit(1);
});
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
