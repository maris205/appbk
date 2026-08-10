import { NextResponse } from "next/server";

type ReviewInput = { rating?: number; title?: string; content?: string };

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const app = body.app || {};
    const reviews: ReviewInput[] = Array.isArray(body.reviews) ? body.reviews.slice(0, 12) : [];
    if (!app.name || !app.id) return NextResponse.json({ error: { message: "缺少 App 数据" } }, { status: 400 });
    const apiKey = process.env.AI_API_KEY;
    const baseUrl = (process.env.AI_BASE_URL || "").replace(/\/$/, "");
    const model = process.env.AI_MODEL || "qwen3.7-max";
    if (!apiKey || !baseUrl) return NextResponse.json({ error: { message: "大模型服务尚未配置" } }, { status: 503 });
    const evidence = { app: { name: String(app.name).slice(0, 160), developer: String(app.developer || "").slice(0, 160), genres: Array.isArray(app.genres) ? app.genres.slice(0, 8) : [], rating: Number(app.rating || 0), ratingCount: Number(app.ratingCount || 0), version: String(app.version || "").slice(0, 50), updatedAt: String(app.currentVersionReleaseDate || "").slice(0, 50), description: String(app.description || "").slice(0, 3000) }, reviews: reviews.map((review) => ({ rating: Number(review.rating || 0), title: String(review.title || "").slice(0, 160), content: String(review.content || "").slice(0, 800) })) };
    const response = await fetch(`${baseUrl}/chat/completions`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model, temperature: 0.2, max_tokens: 900, messages: [{ role: "system", content: "你是 appbk 的 App 增长决策分析师。只能依据用户提供的数据判断，不得编造下载量、收入、关键词排名或因果关系。用简体中文输出，简洁、具体、可执行。固定输出四段：一句话判断、值得关注、潜在风险、下一步建议。明确说明证据不足之处。" }, { role: "user", content: `请分析以下 App Store 数据：\n${JSON.stringify(evidence)}` }] }) });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error?.message || `模型服务返回 ${response.status}`);
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error("模型没有返回分析内容");
    return NextResponse.json({ data: { content, model, generatedAt: new Date().toISOString() }, error: null });
  } catch (error) {
    return NextResponse.json({ data: null, error: { message: error instanceof Error ? error.message : "分析暂时不可用" } }, { status: 502 });
  }
}
