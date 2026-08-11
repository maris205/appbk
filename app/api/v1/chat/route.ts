import { NextResponse } from "next/server";
import { appDataTools, executeAppDataTool } from "../../../../lib/app-data-tools";
import { getUserFromToken, readSessionCookie } from "../../../../lib/auth";

type InputMessage = { role: "user" | "assistant"; content: string };
type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
type ModelMessage =
  | { role: "system" | "user" | "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; name: string; content: string };

const agentInstructions: Record<string, string> = {
  general: "你是综合 App 决策 Agent，帮助用户完成产品、增长、数据分析与商业判断。",
  launch: "你是 App 上架专家，专注 Apple App Store 上架准备、元数据、审核指南、隐私合规、订阅配置、被拒原因排查与发布检查清单。涉及可能变化的苹果规则时，提醒用户以最新官方规则核验。",
  aso: "你是 ASO 专家，专注 App 定位、竞品、标题、副标题、关键词、榜单、评分评论、本地化和自然量增长。区分真实数据、估算与假设，不伪造关键词热度或排名。",
  apple_ads: "你是苹果广告专家，专注 Apple Ads 的账户结构、Campaign、Ad Group、Search Match、关键词匹配、出价、预算和效果诊断。没有账户真实数据时只给分析框架，不编造消耗或转化。",
};

async function complete(baseUrl: string, apiKey: string, body: Record<string, unknown>) {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.message || `模型服务返回 ${response.status}`);
  const message = payload.choices?.[0]?.message;
  if (!message) throw new Error("模型没有返回消息");
  return message as { role: "assistant"; content?: string | null; tool_calls?: ToolCall[] };
}

export async function POST(request: Request) {
  const user = await getUserFromToken(readSessionCookie(request));
  if (!user) return NextResponse.json({ data: null, error: { message: "请先登录后再使用 Agent" } }, { status: 401 });
  try {
    const body = await request.json();
    const country = new Set(["cn", "us", "jp"]).has(body.country) ? body.country : "cn";
    const agent = typeof body.agent === "string" && agentInstructions[body.agent] ? body.agent : "general";
    const input: InputMessage[] = Array.isArray(body.messages) ? body.messages : [];
    const history = input.slice(-20)
      .filter((message) => (message.role === "user" || message.role === "assistant") && typeof message.content === "string" && message.content.trim())
      .map((message) => ({ role: message.role, content: message.content.trim().slice(0, 4000) }));
    if (!history.length) return NextResponse.json({ data: null, error: { message: "请输入问题" } }, { status: 400 });

    const apiKey = process.env.AI_API_KEY;
    const baseUrl = (process.env.AI_BASE_URL || "").replace(/\/$/, "");
    const model = process.env.AI_MODEL || "qwen3.7-max";
    if (!apiKey || !baseUrl) return NextResponse.json({ data: null, error: { message: "大模型服务尚未配置" } }, { status: 503 });

    const marketName = country === "cn" ? "中国区" : country === "us" ? "美国区" : "日本区";
    const messages: ModelMessage[] = [{
      role: "system",
      content: `你是 appbk 的专业 Agent。${agentInstructions[agent]} 当前默认市场是${marketName}。
你可以调用 appbk 数据工具查询 MySQL 中的真实公共数据。用户询问具体 App、当前榜单、排名或榜单变化时，应优先调用工具，不要凭记忆回答。工具参数未指定国家时使用 ${country}。
工具数据的 fetchedAt 是数据时间；回答必须说明数据市场和时间。当前工具只覆盖榜单、App 基础快照和排名历史；数据库没有覆盖的数据要明确说“appbk 暂无该数据”，不得声称可以继续拉取尚未提供的评论、关键词、下载量、收入或广告转化数据。
用简体中文回答，先给结论，再给数据依据和下一步。不要向用户展示内部 SQL、工具参数 JSON 或工具调用过程。`,
    }, ...history];

    const usedTools: string[] = [];
    const toolCache = new Map<string, unknown>();
    let finalContent = "";
    for (let turn = 0; turn < 4; turn += 1) {
      const message = await complete(baseUrl, apiKey, { model, temperature: 0.25, max_tokens: 1800, messages, tools: appDataTools, tool_choice: "auto" });
      const toolCalls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
      if (!toolCalls.length) {
        finalContent = typeof message.content === "string" ? message.content.trim() : "";
        break;
      }
      messages.push({ role: "assistant", content: message.content || null, tool_calls: toolCalls });
      for (const toolCall of toolCalls.slice(0, 5)) {
        const name = toolCall.function?.name;
        if (!name || !toolCall.id) continue;
        usedTools.push(name);
        let result: unknown;
        const cacheKey = `${name}:${toolCall.function.arguments}`;
        if (toolCache.has(cacheKey)) {
          result = toolCache.get(cacheKey);
        } else {
          try {
            result = await executeAppDataTool(name, toolCall.function.arguments);
          } catch (error) {
            result = { error: error instanceof Error ? error.message : "数据工具执行失败" };
          }
          toolCache.set(cacheKey, result);
        }
        messages.push({ role: "tool", tool_call_id: toolCall.id, name, content: JSON.stringify(result).slice(0, 30_000) });
      }
    }
    if (!finalContent) {
      messages.push({ role: "system", content: "停止调用工具。请立即根据上面的工具结果回答用户；如果结果不足，明确说明缺少什么数据。" });
      const message = await complete(baseUrl, apiKey, { model, temperature: 0.2, max_tokens: 1800, messages });
      finalContent = typeof message.content === "string" ? message.content.trim() : "";
    }
    if (!finalContent) throw new Error("Agent 没有生成最终回答");
    return NextResponse.json({ data: { message: { role: "assistant", content: finalContent }, model, agent, tools: [...new Set(usedTools)], user: { id: user.id, email: user.email } }, error: null });
  } catch (error) {
    return NextResponse.json({ data: null, error: { message: error instanceof Error ? error.message : "Agent 暂时不可用" } }, { status: 502 });
  }
}
