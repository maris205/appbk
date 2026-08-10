import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest, context: { params: Promise<{ appId: string }> }) {
  const { appId } = await context.params;
  const country = (request.nextUrl.searchParams.get("country") || "cn").toLowerCase();
  if (!/^\d+$/.test(appId) || !new Set(["cn", "us", "jp"]).has(country)) return NextResponse.json({ error: { message: "App 参数不正确" } }, { status: 400 });
  const key = process.env.RAPIDAPI_KEY;
  const host = process.env.RAPIDAPI_HOST || "app-store-google-play-data-api.p.rapidapi.com";
  if (!key) return NextResponse.json({ error: { message: "RapidAPI 尚未配置" } }, { status: 503 });
  const lang = country === "cn" ? "zh" : country === "jp" ? "ja" : "en";
  const headers = { "x-rapidapi-host": host, "x-rapidapi-key": key };
  try {
    const detailUrl = new URL(`https://${host}/ios/apps/${appId}`);
    detailUrl.searchParams.set("country", country); detailUrl.searchParams.set("lang", lang);
    const reviewUrl = new URL(`https://${host}/ios/apps/${appId}/reviews`);
    reviewUrl.searchParams.set("country", country); reviewUrl.searchParams.set("lang", lang); reviewUrl.searchParams.set("limit", "20"); reviewUrl.searchParams.set("offset", "0");
    const [detailResponse, reviewResponse] = await Promise.all([fetch(detailUrl, { headers, next: { revalidate: 43200 } }), fetch(reviewUrl, { headers, next: { revalidate: 21600 } })]);
    const [detailPayload, reviewPayload] = await Promise.all([detailResponse.json(), reviewResponse.json()]);
    if (!detailResponse.ok || !detailPayload.success) throw new Error("没有找到这个 App");
    const app = detailPayload.data;
    const reviews = reviewResponse.ok && reviewPayload.success ? reviewPayload.data.map((review: Record<string, unknown>) => ({ id: String(review.id), title: String(review.title || ""), content: String(review.content || ""), rating: Number(review.rating || 0), author: String(review.author || "匿名用户"), date: String(review.date || ""), version: String(review.version || "") })) : [];
    return NextResponse.json({ data: { app: { id: String(app.track_id), name: app.track_name, bundleId: app.bundle_id, developer: app.artist_name, genres: app.genres || [], primaryGenre: app.primary_genre, description: app.description, price: app.price || 0, currency: app.currency, rating: app.rating || 0, ratingCount: app.rating_count || 0, contentRating: app.content_rating, iconUrl: app.icon_url, screenshots: app.screenshot_urls || [], releaseDate: app.release_date, currentVersionReleaseDate: app.current_version_release_date, version: app.version, minimumOsVersion: app.minimum_os_version, fileSizeBytes: app.file_size_bytes, storeUrl: app.track_view_url }, reviews }, meta: { country, source: "rapidapi", fetchedAt: new Date().toISOString() }, error: null });
  } catch (error) {
    return NextResponse.json({ data: null, error: { message: error instanceof Error ? error.message : "App 数据暂时不可用" } }, { status: 502 });
  }
}
