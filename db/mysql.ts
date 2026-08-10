import mysql from "mysql2/promise";

declare global {
  var appbkMysqlPool: mysql.Pool | undefined;
}

function createPool() {
  for (const key of ["MYSQL_HOST", "MYSQL_USER", "MYSQL_PASSWORD", "MYSQL_DATABASE"]) {
    if (!process.env[key]) throw new Error(`缺少 MySQL 配置：${key}`);
  }
  return mysql.createPool({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    charset: "utf8mb4",
    waitForConnections: true,
    connectionLimit: 10,
    maxIdle: 5,
    idleTimeout: 60_000,
    queueLimit: 0,
    enableKeepAlive: true,
  });
}

export const mysqlPool = globalThis.appbkMysqlPool || createPool();
if (process.env.NODE_ENV !== "production") globalThis.appbkMysqlPool = mysqlPool;
