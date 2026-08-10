import { NextResponse } from "next/server";
import { getUserFromToken, readSessionCookie } from "../../../../lib/auth";

type ChatMessage = { role: "user" | "assistant"; content: string };

const agentInstructions: Record<string, string> = {
  general: "你是综合 App 决策 Agent，帮助用户完成产品、增长、数据分析与商业判断。",
  launch: "你是 App 上架专家，专注 Apple App Store 上架准备、元数据、审核指南、隐私合规、订阅配置、被拒原因排查与发布检查清单。涉及可能变化的苹果规则时，提醒用户以最新官方规则核验。",
  aso: "你是 ASO 专家，专注 App 定位、竞品、标题、副标题、关键词、榜单、评分评论、本地化和自然量增长。区分真实数据、估算与假设，不伪造关键词热度或排名。",
  apple_ads: "你是苹果广告专家，专注 Apple Ads 的账户结构、Campaign、Ad Group、Search Match、关键词匹配、出价、预算和效果诊断。没有账户真实数据时只给分析框架，不编造消耗或转化。",
};

export async function POST(request: Request) {
  const user = await getUserFromToken(readSessionCookie(request));
  if (!user) return NextResponse.json({ data: null, error: { message: "请先登录后再使用 Agent" } }, { status: 401 });
  try {
    const body = await request.json();
    const country = new Set(["cn", "us", "jp"]).has(body.country) ? body.country : "cn";
    const agent = typeof body.agent === "string" && agentInstructions[body.agent] ? body.agent : "general";
    const input: ChatMessage[] = Array.isArray(body.messages) ? body.messages : [];
    const messages = input.slice(-20).filter((message) => (message.role === "user" || message.role === "assistant") && typeof message.content === "string" && message.content.trim()).map((message) => ({ role: message.role, content: message.content.trim().slice(0, 4000) }));
    if (!messages.length) return NextResponse.json({ data: null, error: { message: "请输入问题" } }, { status: 400 });
    const apiKey = process.env.AI_API_KEY;
    const baseUrl = (process.env.AI_BASE_URL || "").replace(/\/$/, "");
    const model = process.env.AI_MODEL || "qwen3.7-max";
    if (!apiKey || !baseUrl) return NextResponse.json({ data: null, error: { message: "大模型服务尚未配置" } }, { status: 503 });
    const response = await fetch(`${baseUrl}/chat/completions`, { method:"POST", headers:{ "Content-Type":"application/json", Authorization:`Bearer ${apiKey}` }, body:JSON.stringify({ model, temperature:0.35, max_tokens:1400, messages:[{ role:"system", content:`你是 appbk 的专业 Agent。${agentInstructions[agent]} 当前默认市场是${country === "cn" ? "中国区" : country === "us" ? "美国区" : "日本区"}。用简体中文回答，先给结论，再给依据和下一步。没有实时数据时必须明确说明，不能编造排名、下载量、收入、广告数据或苹果规则，并建议用户进入 appbk 数据大盘或官方后台核验。` }, ...messages] }) });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error?.message || `模型服务返回 ${response.status}`);
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error("模型没有返回内容");
    return NextResponse.json({ data:{ message:{ role:"assistant", content }, model, agent, user:{ id:user.id, email:user.email } }, error:null });
  } catch (error) {
    return NextResponse.json({ data:null, error:{ message:error instanceof Error ? error.message : "Agent 暂时不可用" } }, { status:502 });
  }
}
