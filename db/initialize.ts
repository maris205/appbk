import type { RowDataPacket } from "mysql2";
import { mysqlPool } from "./mysql";

let initialization: Promise<void> | null = null;

export async function ensureDatabase() {
  if (!initialization) initialization = mysqlPool.query("SELECT 1").then(() => undefined).catch((error) => { initialization = null; throw error; });
  return initialization;
}

export type StoredSearchApp = { id:string; name:string; developer:string; iconUrl:string; price:number; rating:number; ratingCount:number };

export async function saveSearchResults(apps: StoredSearchApp[], country: string) {
  if (!apps.length) return;
  await ensureDatabase();
  const connection = await mysqlPool.getConnection();
  const now = Date.now();
  try {
    await connection.beginTransaction();
    for (const app of apps) {
      await connection.execute("INSERT INTO apps (apple_id,name,developer,icon_url,created_at,updated_at) VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),developer=VALUES(developer),icon_url=VALUES(icon_url),updated_at=VALUES(updated_at)", [app.id,app.name,app.developer,app.iconUrl,now,now]);
      const [rows] = await connection.execute<(RowDataPacket & { id: number })[]>("SELECT id FROM apps WHERE apple_id=? LIMIT 1", [app.id]);
      await connection.execute("INSERT INTO app_snapshots (app_id,country,price,rating,rating_count,raw_json,fetched_at) VALUES (?,?,?,?,?,?,?)", [rows[0].id,country,app.price,app.rating,app.ratingCount,JSON.stringify(app),now]);
    }
    await connection.commit();
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}

export type StoredRankingApp = { id:string; name:string; developer:string; iconUrl:string; price:number; rank:number };

export async function saveRankingResults(apps: StoredRankingApp[], country: string, category: string, collection: string) {
  if (!apps.length) return;
  await ensureDatabase();
  const connection = await mysqlPool.getConnection();
  const now = Date.now();
  try {
    await connection.beginTransaction();
    for (const app of apps) {
      await connection.execute("INSERT INTO apps (apple_id,name,developer,icon_url,created_at,updated_at) VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),developer=VALUES(developer),icon_url=VALUES(icon_url),updated_at=VALUES(updated_at)", [app.id,app.name,app.developer,app.iconUrl,now,now]);
      const [rows] = await connection.execute<(RowDataPacket & { id: number })[]>("SELECT id FROM apps WHERE apple_id=? LIMIT 1", [app.id]);
      await connection.execute("INSERT INTO ranking_snapshots (app_id,country,category,collection,`rank`,fetched_at) VALUES (?,?,?,?,?,?)", [rows[0].id,country,category,collection,app.rank,now]);
    }
    await connection.commit();
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}
