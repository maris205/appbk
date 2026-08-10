import { NextRequest, NextResponse } from "next/server";
import { saveRankingResults } from "../../../../db/initialize";

const collections = new Set(["topfreeapplications", "toppaidapplications", "topgrossingapplications"]);

export async function GET(request: NextRequest) {
  const country = (request.nextUrl.searchParams.get("country") || "cn").toLowerCase();
  const collection = request.nextUrl.searchParams.get("collection") || "topfreeapplications";
  const category = request.nextUrl.searchParams.get("category") || "";
  const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get("limit") || 50), 1), 100);
  if (!new Set(["cn", "us", "jp"]).has(country) || !collections.has(collection)) return NextResponse.json({ error: { message: "榜单参数不正确" } }, { status: 400 });
  const key = process.env.RAPIDAPI_KEY;
  const host = process.env.RAPIDAPI_HOST || "app-store-google-play-data-api.p.rapidapi.com";
  if (!key) return NextResponse.json({ error: { message: "RapidAPI 尚未配置" } }, { status: 503 });

  const url = new URL(`https://${host}/ios/top/${collection}`);
  url.searchParams.set("country", country);
  url.searchParams.set("lang", country === "cn" ? "zh" : country === "jp" ? "ja" : "en");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", "0");
  if (category) url.searchParams.set("category", category);
  try {
    const response = await fetch(url, { headers: { "x-rapidapi-host": host, "x-rapidapi-key": key }, next: { revalidate: 21600 } });
    const payload = await response.json();
    if (!response.ok || !payload.success) throw new Error(payload.message || "榜单服务暂时不可用");
    const data = payload.data.map((app: Record<string, unknown>) => ({ rank: Number(app.rank), id: String(app.track_id), name: String(app.track_name || "未命名 App"), developer: String(app.artist_name || "未知开发者"), iconUrl: String(app.icon_url || ""), bundleId: String(app.bundle_id || ""), price: Number(app.price || 0), genres: Array.isArray(app.genres) ? app.genres : [] }));
    await saveRankingResults(data, country, category || "all", collection);
    return NextResponse.json({ data, meta: { country, collection, category: category || "all", source: "rapidapi", fetchedAt: new Date().toISOString() }, error: null });
  } catch (error) {
    return NextResponse.json({ data: null, error: { message: error instanceof Error ? error.message : "榜单服务暂时不可用" } }, { status: 502 });
  }
}
