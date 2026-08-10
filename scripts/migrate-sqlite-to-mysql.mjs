import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import mysql from "mysql2/promise";

const d1Directory = ".wrangler/state/v3/d1/miniflare-D1DatabaseObject";
const sqlitePath = process.env.SQLITE_SOURCE || (existsSync(d1Directory) ? readdirSync(d1Directory).filter((name) => name.endsWith(".sqlite") && name !== "metadata.sqlite").map((name) => join(d1Directory, name))[0] : null);
if (!sqlitePath) throw new Error("没有找到本地 SQLite 数据库，请设置 SQLITE_SOURCE");
for (const key of ["MYSQL_HOST", "MYSQL_USER", "MYSQL_PASSWORD", "MYSQL_DATABASE"]) if (!process.env[key]) throw new Error(`缺少环境变量 ${key}`);

const connection = await mysql.createConnection({ host:process.env.MYSQL_HOST, port:Number(process.env.MYSQL_PORT || 3306), user:process.env.MYSQL_USER, password:process.env.MYSQL_PASSWORD, database:process.env.MYSQL_DATABASE, charset:"utf8mb4", connectTimeout:10_000, multipleStatements:true });
const schema = readFileSync("db/mysql-schema.sql", "utf8");

function readTable(table) {
  const output = execFileSync("sqlite3", ["-json", sqlitePath, `SELECT * FROM ${table}`], { encoding:"utf8" }).trim();
  return output ? JSON.parse(output) : [];
}

const tables = ["users", "sessions", "apps", "app_snapshots", "ranking_snapshots", "reviews", "keywords", "keyword_ranking_snapshots", "insights"];
const rowsByTable = Object.fromEntries(tables.map((table) => [table, readTable(table)]));

await connection.beginTransaction();
try {
  await connection.query(schema);
  for (const table of tables) {
    for (const row of rowsByTable[table]) {
      const columns = Object.keys(row);
      const placeholders = columns.map(() => "?").join(",");
      const updates = columns.filter((column) => column !== "id").map((column) => `\`${column}\`=VALUES(\`${column}\`)`).join(",");
      await connection.execute(`INSERT INTO \`${table}\` (${columns.map((column) => `\`${column}\``).join(",")}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updates}`, columns.map((column) => row[column]));
    }
  }
  await connection.commit();
} catch (error) {
  await connection.rollback();
  throw error;
}

const counts = {};
for (const table of tables) {
  const [rows] = await connection.query(`SELECT COUNT(*) AS count FROM \`${table}\``);
  counts[table] = Number(rows[0].count);
}
await connection.end();
console.log(JSON.stringify({ migrated:true, source:sqlitePath, counts }, null, 2));
