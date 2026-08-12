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
      name: "list_app_categories",
      description: "查询某个 App Store 市场中 appbk 已收录的分类目录。用户提到分类名称但分类 ID 不明确时先调用此工具。",
      parameters: {
        type: "object",
        properties: {
          country: { type: "string", enum: ["cn", "us", "jp"], description: "App Store 市场" },
          query: { type: "string", description: "可选的分类名称关键词，例如摄影、效率、游戏；不传则返回全部分类" },
        },
        required: ["country"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_category_rankings",
      description: "按分类名称或分类 ID 查询某个市场最新的分类榜。适合回答摄影、效率、游戏等垂直分类当前有哪些 App。",
      parameters: {
        type: "object",
        properties: {
          country: { type: "string", enum: ["cn", "us", "jp"] },
          category: { type: "string", description: "分类名称或分类 ID，例如摄影与录像、Photo & Video、6008" },
          collection: { type: "string", enum: ["topfreeapplications", "toppaidapplications", "topgrossingapplications"] },
          limit: { type: "integer", minimum: 1, maximum: 50 },
        },
        required: ["country", "category", "collection"],
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
      name: "get_app_full_detail",
      description: "查询一个 App 的完整公共详情快照，包括描述、更新说明、分类、版本、价格、评分、系统要求、发布时间、截图和当前榜单位置。",
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
      name: "get_app_reviews",
      description: "查询一个 App 在指定市场中已采集的最新评论。适合查找用户原话、具体投诉、好评理由和版本反馈。",
      parameters: {
        type: "object",
        properties: {
          app: { type: "string", description: "Apple ID 或准确的 App 名称" },
          country: { type: "string", enum: ["cn", "us", "jp"] },
          rating: { type: "integer", minimum: 1, maximum: 5, description: "可选；只返回指定星级" },
          limit: { type: "integer", minimum: 1, maximum: 30 },
        },
        required: ["app", "country"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "summarize_review_signals",
      description: "汇总一个 App 的评论信号，包括评分分布、近期与前期均分、低星占比、版本评分和代表性差评。适合诊断评分变化和集中问题。",
      parameters: {
        type: "object",
        properties: {
          app: { type: "string", description: "Apple ID 或准确的 App 名称" },
          country: { type: "string", enum: ["cn", "us", "jp"] },
          days: { type: "integer", minimum: 1, maximum: 365, description: "统计最近多少天，默认 90 天" },
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

function jsonArray(value: unknown, limit = 20) {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed.slice(0, limit) : [];
  } catch {
    return [];
  }
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

async function listAppCategories(args: Record<string, unknown>) {
  const market = country(args.country);
  const query = text(args.query, "", 100);
  const params: string[] = [market];
  let filter = "";
  if (query) { filter = " AND (name LIKE ? OR category_id=?)"; params.push(`%${query}%`, query); }
  const [rows] = await mysqlPool.execute<RowDataPacket[]>(
    `SELECT category_id,name,parent_id,fetched_at FROM app_categories WHERE country=?${filter} ORDER BY parent_id IS NOT NULL,parent_id,name LIMIT 100`,
    params,
  );
  const fetchedAt = rows.reduce((latest, row) => Math.max(latest, Number(row.fetched_at || 0)), 0);
  return { source:"appbk_mysql", country:market, query:query || null, fetchedAt:iso(fetchedAt), count:rows.length, data:rows.map((row) => ({ category_id:row.category_id, name:row.name, parent_id:row.parent_id })) };
}

async function resolveCategory(market: string, categoryInput: unknown) {
  const category = text(categoryInput, "", 100);
  if (!category) throw new Error("category 不能为空");
  const [exact] = await mysqlPool.execute<RowDataPacket[]>(
    "SELECT category_id,name,parent_id,fetched_at FROM app_categories WHERE country=? AND (category_id=? OR name=?) ORDER BY (category_id=?) DESC LIMIT 1",
    [market, category, category, category],
  );
  if (exact[0]) return exact[0];
  const [fuzzy] = await mysqlPool.execute<RowDataPacket[]>(
    "SELECT category_id,name,parent_id,fetched_at FROM app_categories WHERE country=? AND name LIKE ? ORDER BY CHAR_LENGTH(name),name LIMIT 5",
    [market, `%${category}%`],
  );
  if (!fuzzy[0]) throw new Error(`数据库中没有找到分类：${category}`);
  if (fuzzy.length > 1) return { ...fuzzy[0], alternatives:fuzzy.slice(1).map((row) => ({ category_id:row.category_id, name:row.name })) };
  return fuzzy[0];
}

async function getCategoryRankings(args: Record<string, unknown>) {
  const market = country(args.country);
  const chart = collection(args.collection);
  const category = await resolveCategory(market, args.category);
  const result = await getMarketRankings({ country:market, collection:chart, category:category.category_id, limit:args.limit });
  return { ...result, category:{ category_id:category.category_id, name:category.name, parent_id:category.parent_id }, alternatives:category.alternatives || [] };
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

async function getAppFullDetail(args: Record<string, unknown>) {
  const market = country(args.country);
  const app = await findApp(args.app);
  const [snapshots] = await mysqlPool.execute<RowDataPacket[]>(
    `SELECT version,price,rating,rating_count,description,release_notes,genres_json,primary_genre,currency,
      content_rating,minimum_os_version,file_size_bytes,release_date,current_version_release_date,
      screenshots_json,store_url,fetched_at FROM app_snapshots
     WHERE app_id=? AND country=? AND description IS NOT NULL ORDER BY fetched_at DESC LIMIT 1`,
    [app.id, market],
  );
  const [rankings] = await mysqlPool.execute<RowDataPacket[]>(
    `SELECT r.category,COALESCE(c.name,r.category) category_name,r.collection,r.\`rank\`,r.fetched_at
     FROM ranking_snapshots r LEFT JOIN app_categories c ON c.country=r.country AND c.category_id=r.category
     WHERE r.app_id=? AND r.country=? AND r.fetched_at=(SELECT MAX(r2.fetched_at) FROM ranking_snapshots r2 WHERE r2.country=r.country AND r2.category=r.category AND r2.collection=r.collection)
     ORDER BY r.\`rank\` LIMIT 30`,
    [app.id, market],
  );
  const row = snapshots[0];
  const snapshot = row ? {
    version:row.version, price:row.price, currency:row.currency, rating:row.rating, rating_count:row.rating_count,
    description:text(row.description, "", 6000), release_notes:text(row.release_notes, "", 3000),
    genres:jsonArray(row.genres_json), primary_genre:row.primary_genre, content_rating:row.content_rating,
    minimum_os_version:row.minimum_os_version, file_size_bytes:row.file_size_bytes,
    release_date:iso(row.release_date), current_version_release_date:iso(row.current_version_release_date),
    screenshots:jsonArray(row.screenshots_json, 10), store_url:row.store_url, fetched_at:iso(row.fetched_at),
  } : null;
  return { source:"appbk_mysql", country:market, app:{ apple_id:app.apple_id, name:app.name, developer:app.developer, icon_url:app.icon_url }, latestSnapshot:snapshot, currentRankings:rankings.map((ranking) => ({ ...ranking, fetched_at:iso(ranking.fetched_at) })) };
}

async function getAppReviews(args: Record<string, unknown>) {
  const market = country(args.country);
  const app = await findApp(args.app);
  const limit = integer(args.limit, 15, 1, 30);
  const requestedRating = args.rating === undefined ? null : integer(args.rating, 0, 1, 5);
  const params: Array<string|number> = [app.id, market];
  const ratingFilter = requestedRating ? " AND rating=?" : "";
  if (requestedRating) params.push(requestedRating);
  const [rows] = await mysqlPool.execute<RowDataPacket[]>(
    `SELECT provider_id,rating,title,body,author,app_version,published_at FROM reviews WHERE app_id=? AND country=?${ratingFilter} ORDER BY published_at DESC LIMIT ${limit}`,
    params,
  );
  const [syncRows] = await mysqlPool.execute<RowDataPacket[]>("SELECT fetched_at FROM review_sync_state WHERE app_id=? AND country=? LIMIT 1", [app.id, market]);
  return { source:"appbk_mysql", country:market, app:{ apple_id:app.apple_id, name:app.name }, rating:requestedRating, fetchedAt:iso(syncRows[0]?.fetched_at), count:rows.length, data:rows.map((row) => ({ ...row, title:text(row.title,"",300), body:text(row.body,"",1200), published_at:iso(row.published_at) })) };
}

async function summarizeReviewSignals(args: Record<string, unknown>) {
  const market = country(args.country);
  const app = await findApp(args.app);
  const days = integer(args.days, 90, 1, 365);
  const since = Date.now() - days * 86_400_000;
  const midpoint = Date.now() - Math.ceil(days / 2) * 86_400_000;
  const [summaryRows] = await mysqlPool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) total,ROUND(AVG(rating),3) average_rating,
      SUM(rating=1) rating_1,SUM(rating=2) rating_2,SUM(rating=3) rating_3,SUM(rating=4) rating_4,SUM(rating=5) rating_5,
      SUM(rating<=2) low_rating_count,MIN(published_at) earliest_review_at,MAX(published_at) latest_review_at
     FROM reviews WHERE app_id=? AND country=? AND published_at>=?`,
    [app.id, market, since],
  );
  const [periodRows] = await mysqlPool.execute<RowDataPacket[]>(
    `SELECT IF(published_at>=?,'recent','previous') period,COUNT(*) total,ROUND(AVG(rating),3) average_rating,SUM(rating<=2) low_rating_count
     FROM reviews WHERE app_id=? AND country=? AND published_at>=? GROUP BY period`,
    [midpoint, app.id, market, since],
  );
  const [versionRows] = await mysqlPool.execute<RowDataPacket[]>(
    `SELECT COALESCE(NULLIF(app_version,''),'未知版本') app_version,COUNT(*) total,ROUND(AVG(rating),3) average_rating,SUM(rating<=2) low_rating_count,MAX(published_at) latest_review_at
     FROM reviews WHERE app_id=? AND country=? AND published_at>=? GROUP BY app_version ORDER BY total DESC,latest_review_at DESC LIMIT 10`,
    [app.id, market, since],
  );
  const [lowRows] = await mysqlPool.execute<RowDataPacket[]>(
    `SELECT rating,title,body,app_version,published_at FROM reviews WHERE app_id=? AND country=? AND published_at>=? AND rating<=2 ORDER BY published_at DESC LIMIT 10`,
    [app.id, market, since],
  );
  const [syncRows] = await mysqlPool.execute<RowDataPacket[]>("SELECT fetched_at FROM review_sync_state WHERE app_id=? AND country=? LIMIT 1", [app.id, market]);
  const summary = summaryRows[0] || {};
  const total = Number(summary.total || 0);
  return {
    source:"appbk_mysql", country:market, days, fetchedAt:iso(syncRows[0]?.fetched_at), app:{ apple_id:app.apple_id, name:app.name },
    summary:{ total, average_rating:summary.average_rating, low_rating_count:Number(summary.low_rating_count || 0), low_rating_ratio:total ? Number(summary.low_rating_count || 0) / total : 0, rating_distribution:{ 1:Number(summary.rating_1 || 0),2:Number(summary.rating_2 || 0),3:Number(summary.rating_3 || 0),4:Number(summary.rating_4 || 0),5:Number(summary.rating_5 || 0) }, earliest_review_at:iso(summary.earliest_review_at), latest_review_at:iso(summary.latest_review_at) },
    periods:periodRows.map((row) => ({ ...row, total:Number(row.total), low_rating_count:Number(row.low_rating_count || 0) })),
    versions:versionRows.map((row) => ({ ...row, total:Number(row.total), low_rating_count:Number(row.low_rating_count || 0), latest_review_at:iso(row.latest_review_at) })),
    representative_low_reviews:lowRows.map((row) => ({ ...row, title:text(row.title,"",300), body:text(row.body,"",1200), published_at:iso(row.published_at) })),
  };
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
    case "list_app_categories": return listAppCategories(args);
    case "get_category_rankings": return getCategoryRankings(args);
    case "search_apps": return searchApps(args);
    case "get_app_detail": return getAppDetail(args);
    case "get_app_full_detail": return getAppFullDetail(args);
    case "get_app_reviews": return getAppReviews(args);
    case "summarize_review_signals": return summarizeReviewSignals(args);
    case "get_app_rank_history": return getAppRankHistory(args);
    case "get_market_changes": return getMarketChanges(args);
    default: throw new Error(`不支持的数据工具：${name}`);
  }
}
