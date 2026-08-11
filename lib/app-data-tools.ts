import type { RowDataPacket } from "mysql2";
import { mysqlPool } from "../db/mysql";

type JsonSchema = {
  type: "object";
  properties: Record<string, Record<string, unknown>>;
  required?: string[];
  additionalProperties: false;
};

export type AppDataTool = {
  type: "function";
  function: { name: string; description: string; parameters: JsonSchema };
};

export const appDataTools: AppDataTool[] = [
  {
    type: "function",
    function: {
      name: "get_market_rankings",
      description: "查询 appbk 数据库中某个市场最新的 App Store 榜单。适合回答当前榜单、头部 App、某类榜单有哪些产品。",
      parameters: {
        type: "object",
        properties: {
          country: { type: "string", enum: ["cn", "us", "jp"], description: "App Store 市场" },
          collection: { type: "string", enum: ["topfreeapplications", "toppaidapplications", "topgrossingapplications"], description: "免费榜、付费榜或畅销榜" },
          category: { type: "string", description: "分类 ID；总榜使用 all" },
          limit: { type: "integer", minimum: 1, maximum: 50, description: "返回数量" },
        },
        required: ["country", "collection"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_apps",
      description: "在 appbk 数据库中按 App 名称、开发者或 Apple ID 搜索 App。",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "App 名称、开发者或 Apple ID" },
          country: { type: "string", enum: ["cn", "us", "jp"], description: "用于返回该市场的最新评分数据" },
          limit: { type: "integer", minimum: 1, maximum: 20 },
        },
        required: ["query", "country"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_app_detail",
      description: "查询一个 App 的基础信息、指定市场最新评分，以及目前记录到的最新榜单位置。先用 search_apps 确定 Apple ID 可提高准确度。",
      parameters: {
        type: "object",
        properties: {
          app: { type: "string", description: "Apple ID 或准确的 App 名称" },
          country: { type: "string", enum: ["cn", "us", "jp"] },
        },
        required: ["app", "country"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_app_rank_history",
      description: "查询一个 App 在指定市场和榜单中的排名历史，用于判断上升、下降和稳定性。",
      parameters: {
        type: "object",
        properties: {
          app: { type: "string", description: "Apple ID 或准确的 App 名称" },
          country: { type: "string", enum: ["cn", "us", "jp"] },
          collection: { type: "string", enum: ["topfreeapplications", "toppaidapplications", "topgrossingapplications"] },
          category: { type: "string", description: "分类 ID；总榜使用 all" },
          days: { type: "integer", minimum: 1, maximum: 90 },
        },
        required: ["app", "country", "collection"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_market_changes",
      description: "比较某市场同一榜单最近两批快照，返回新上榜、上升和下降的 App。",
      parameters: {
        type: "object",
        properties: {
          country: { type: "string", enum: ["cn", "us", "jp"] },
          collection: { type: "string", enum: ["topfreeapplications", "toppaidapplications", "topgrossingapplications"] },
          category: { type: "string", description: "分类 ID；总榜使用 all" },
          limit: { type: "integer", minimum: 1, maximum: 30 },
        },
        required: ["country", "collection"],
        additionalProperties: false,
      },
    },
  },
];

const countries = new Set(["cn", "us", "jp"]);
const collections = new Set(["topfreeapplications", "toppaidapplications", "topgrossingapplications"]);

function text(value: unknown, fallback = "", max = 200) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : fallback;
}

function country(value: unknown) {
  const result = text(value, "cn", 2).toLowerCase();
  if (!countries.has(result)) throw new Error("country 仅支持 cn、us、jp");
  return result;
}

function collection(value: unknown) {
  const result = text(value, "topfreeapplications", 40);
  if (!collections.has(result)) throw new Error("collection 参数不正确");
  return result;
}

function integer(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(Math.max(Math.trunc(parsed), min), max) : fallback;
}

function iso(value: unknown) {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

async function findApp(appInput: unknown) {
  const app = text(appInput, "", 200);
  if (!app) throw new Error("缺少 App 名称或 Apple ID");
  const [rows] = await mysqlPool.execute<(RowDataPacket & { id: number; apple_id: string; name: string; developer: string | null; icon_url: string | null })[]>(
    "SELECT id,apple_id,name,developer,icon_url FROM apps WHERE apple_id=? OR name=? ORDER BY (apple_id=?) DESC,updated_at DESC LIMIT 1",
    [app, app, app],
  );
  if (rows[0]) return rows[0];
  const [fuzzy] = await mysqlPool.execute<(RowDataPacket & { id: number; apple_id: string; name: string; developer: string | null; icon_url: string | null })[]>(
    "SELECT id,apple_id,name,developer,icon_url FROM apps WHERE name LIKE ? ORDER BY updated_at DESC LIMIT 1",
    [`%${app}%`],
  );
  if (!fuzzy[0]) throw new Error(`数据库中没有找到 App：${app}`);
  return fuzzy[0];
}

async function getMarketRankings(args: Record<string, unknown>) {
  const market = country(args.country);
  const chart = collection(args.collection);
  const category = text(args.category, "all", 64);
  const limit = integer(args.limit, 10, 1, 50);
  const [batchRows] = await mysqlPool.execute<(RowDataPacket & { fetched_at: number })[]>(
    "SELECT MAX(fetched_at) fetched_at FROM ranking_snapshots WHERE country=? AND category=? AND collection=?",
    [market, category, chart],
  );
  const fetchedAt = Number(batchRows[0]?.fetched_at || 0);
  if (!fetchedAt) return { source: "appbk_mysql", country: market, category, collection: chart, fetchedAt: null, data: [] };
  const [rows] = await mysqlPool.execute<RowDataPacket[]>(
    `SELECT r.\`rank\`,a.apple_id,a.name,a.developer,a.icon_url FROM ranking_snapshots r JOIN apps a ON a.id=r.app_id WHERE r.country=? AND r.category=? AND r.collection=? AND r.fetched_at=? ORDER BY r.\`rank\` LIMIT ${limit}`,
    [market, category, chart, fetchedAt],
  );
  return { source: "appbk_mysql", country: market, category, collection: chart, fetchedAt: iso(fetchedAt), count: rows.length, data: rows };
}

async function searchApps(args: Record<string, unknown>) {
  const query = text(args.query, "", 200);
  if (!query) throw new Error("query 不能为空");
  const market = country(args.country);
  const limit = integer(args.limit, 8, 1, 20);
  const like = `%${query}%`;
  const [rows] = await mysqlPool.execute<RowDataPacket[]>(
    `SELECT a.apple_id,a.name,a.developer,a.icon_url,s.version,s.price,s.rating,s.rating_count,s.fetched_at
     FROM apps a
     LEFT JOIN app_snapshots s ON s.id=(SELECT s2.id FROM app_snapshots s2 WHERE s2.app_id=a.id AND s2.country=? ORDER BY s2.fetched_at DESC LIMIT 1)
     WHERE a.apple_id=? OR a.name LIKE ? OR a.developer LIKE ?
     ORDER BY (a.apple_id=?) DESC,(a.name=?) DESC,a.updated_at DESC LIMIT ${limit}`,
    [market, query, like, like, query, query],
  );
  return { source: "appbk_mysql", country: market, query, count: rows.length, data: rows.map((row) => ({ ...row, fetched_at: iso(row.fetched_at) })) };
}

async function getAppDetail(args: Record<string, unknown>) {
  const market = country(args.country);
  const app = await findApp(args.app);
  const [snapshots] = await mysqlPool.execute<RowDataPacket[]>(
    "SELECT version,price,rating,rating_count,fetched_at FROM app_snapshots WHERE app_id=? AND country=? ORDER BY fetched_at DESC LIMIT 1",
    [app.id, market],
  );
  const [rankings] = await mysqlPool.execute<RowDataPacket[]>(
    `SELECT r.category,r.collection,r.\`rank\`,r.fetched_at FROM ranking_snapshots r
     WHERE r.app_id=? AND r.country=? AND r.fetched_at=(SELECT MAX(r2.fetched_at) FROM ranking_snapshots r2 WHERE r2.country=r.country AND r2.category=r.category AND r2.collection=r.collection)
     ORDER BY r.\`rank\` LIMIT 20`,
    [app.id, market],
  );
  const snapshot = snapshots[0] ? { ...snapshots[0], fetched_at: iso(snapshots[0].fetched_at) } : null;
  return { source: "appbk_mysql", country: market, app: { apple_id: app.apple_id, name: app.name, developer: app.developer, icon_url: app.icon_url }, latestSnapshot: snapshot, currentRankings: rankings.map((row) => ({ ...row, fetched_at: iso(row.fetched_at) })) };
}

async function getAppRankHistory(args: Record<string, unknown>) {
  const market = country(args.country);
  const chart = collection(args.collection);
  const category = text(args.category, "all", 64);
  const days = integer(args.days, 30, 1, 90);
  const app = await findApp(args.app);
  const since = Date.now() - days * 86_400_000;
  const [rows] = await mysqlPool.execute<RowDataPacket[]>(
    "SELECT `rank`,fetched_at FROM ranking_snapshots WHERE app_id=? AND country=? AND category=? AND collection=? AND fetched_at>=? ORDER BY fetched_at ASC LIMIT 500",
    [app.id, market, category, chart, since],
  );
  return { source: "appbk_mysql", country: market, category, collection: chart, days, app: { apple_id: app.apple_id, name: app.name }, count: rows.length, data: rows.map((row) => ({ rank: row.rank, fetched_at: iso(row.fetched_at) })) };
}

async function getMarketChanges(args: Record<string, unknown>) {
  const market = country(args.country);
  const chart = collection(args.collection);
  const category = text(args.category, "all", 64);
  const limit = integer(args.limit, 15, 1, 30);
  const [batches] = await mysqlPool.execute<(RowDataPacket & { fetched_at: number })[]>(
    "SELECT DISTINCT fetched_at FROM ranking_snapshots WHERE country=? AND category=? AND collection=? ORDER BY fetched_at DESC LIMIT 2",
    [market, category, chart],
  );
  if (batches.length < 2) return { source: "appbk_mysql", country: market, category, collection: chart, message: "历史批次不足，暂时无法比较", data: [] };
  const latest = Number(batches[0].fetched_at);
  const previous = Number(batches[1].fetched_at);
  const [rows] = await mysqlPool.execute<RowDataPacket[]>(
    `SELECT a.apple_id,a.name,current_rank.\`rank\` current_rank,previous_rank.\`rank\` previous_rank,
       CASE WHEN previous_rank.\`rank\` IS NULL THEN NULL ELSE previous_rank.\`rank\`-current_rank.\`rank\` END rank_change
     FROM ranking_snapshots current_rank JOIN apps a ON a.id=current_rank.app_id
     LEFT JOIN ranking_snapshots previous_rank ON previous_rank.app_id=current_rank.app_id AND previous_rank.country=current_rank.country AND previous_rank.category=current_rank.category AND previous_rank.collection=current_rank.collection AND previous_rank.fetched_at=?
     WHERE current_rank.country=? AND current_rank.category=? AND current_rank.collection=? AND current_rank.fetched_at=?
     ORDER BY (previous_rank.\`rank\` IS NULL) DESC,rank_change DESC,current_rank.\`rank\` ASC LIMIT ${limit}`,
    [previous, market, category, chart, latest],
  );
  return { source: "appbk_mysql", country: market, category, collection: chart, latestAt: iso(latest), previousAt: iso(previous), count: rows.length, data: rows };
}

export async function executeAppDataTool(name: string, rawArguments: string | Record<string, unknown>) {
  let args: Record<string, unknown>;
  try {
    args = typeof rawArguments === "string" ? JSON.parse(rawArguments || "{}") : rawArguments;
  } catch {
    throw new Error("工具参数不是有效 JSON");
  }
  if (!args || Array.isArray(args) || typeof args !== "object") throw new Error("工具参数必须是对象");
  switch (name) {
    case "get_market_rankings": return getMarketRankings(args);
    case "search_apps": return searchApps(args);
    case "get_app_detail": return getAppDetail(args);
    case "get_app_rank_history": return getAppRankHistory(args);
    case "get_market_changes": return getMarketChanges(args);
    default: throw new Error(`不支持的数据工具：${name}`);
  }
}
