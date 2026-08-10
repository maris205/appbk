import { NextRequest, NextResponse } from "next/server";
import { saveSearchResults } from "../../../../../db/initialize";

type UpstreamApp = {
  track_id: number | string;
  track_name?: string;
  artist_name?: string;
  icon_url?: string;
  price?: number;
  rating?: number;
  rating_count?: number;
  genres?: string[];
  track_view_url?: string;
};

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  const country = (request.nextUrl.searchParams.get("country") || "us").toLowerCase();
  const requestedLimit = Number(request.nextUrl.searchParams.get("limit") || 8);
  const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 8, 1), 25);

  if (!q) return NextResponse.json({ data: null, meta: null, error: { code: "INVALID_QUERY", message: "请输入 App 名称或 App ID" } }, { status: 400 });
  if (!new Set(["cn", "us", "jp"]).has(country)) return NextResponse.json({ data: null, meta: null, error: { code: "INVALID_COUNTRY", message: "暂时只支持中国、美国和日本" } }, { status: 400 });

  const key = process.env.RAPIDAPI_KEY;
  const host = process.env.RAPIDAPI_HOST || "app-store-google-play-data-api.p.rapidapi.com";
  if (!key) return NextResponse.json({ data: null, meta: null, error: { code: "MISSING_CONFIGURATION", message: "RapidAPI 尚未配置" } }, { status: 503 });

  const upstream = new URL(`https://${host}/ios/search`);
  upstream.searchParams.set("q", q);
  upstream.searchParams.set("country", country);
  upstream.searchParams.set("lang", country === "cn" ? "zh" : country === "jp" ? "ja" : "en");
  upstream.searchParams.set("limit", String(limit));

  try {
    const response = await fetch(upstream, { headers: { "Content-Type": "application/json", "x-rapidapi-host": host, "x-rapidapi-key": key }, next: { revalidate: 21600 } });
    const payload = await response.json();
    if (!response.ok || !payload.success) throw new Error(payload.message || payload.detail?.[0]?.msg || `上游接口返回 ${response.status}`);
    const data = (payload.data as UpstreamApp[]).map((app) => ({
      id: String(app.track_id), name: app.track_name || "未命名 App", developer: app.artist_name || "未知开发者", iconUrl: app.icon_url || "", price: app.price || 0,
      rating: app.rating || 0, ratingCount: app.rating_count || 0, genres: app.genres || [], storeUrl: app.track_view_url || `https://apps.apple.com/app/id${app.track_id}`,
    }));
    await saveSearchResults(data, country);
    return NextResponse.json({ data, meta: { country, source: "rapidapi", fetchedAt: new Date().toISOString(), cached: false }, error: null });
  } catch (cause) {
    return NextResponse.json({ data: null, meta: { country, source: "rapidapi", fetchedAt: new Date().toISOString(), cached: false }, error: { code: "UPSTREAM_ERROR", message: cause instanceof Error ? cause.message : "数据服务暂时不可用" } }, { status: 502 });
  }
}
