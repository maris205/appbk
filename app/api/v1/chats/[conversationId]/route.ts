import { NextResponse } from "next/server";
import { getUserFromToken, readSessionCookie } from "../../../../../lib/auth";
import { getConversation, listMessages } from "../../../../../lib/chat-history";

export async function GET(request: Request, context: { params: Promise<{ conversationId:string }> }) {
  const user = await getUserFromToken(readSessionCookie(request));
  if (!user) return NextResponse.json({ data:null, error:{ message:"请先登录" } }, { status:401 });
  const { conversationId:rawId } = await context.params;
  const conversationId = Number(rawId);
  if (!Number.isSafeInteger(conversationId) || conversationId < 1) return NextResponse.json({ data:null, error:{ message:"对话参数不正确" } }, { status:400 });
  try {
    const conversation = await getConversation(user.id, conversationId);
    if (!conversation) return NextResponse.json({ data:null, error:{ message:"对话不存在" } }, { status:404 });
    return NextResponse.json({ data:{ conversation, messages:await listMessages(conversationId) }, error:null });
  } catch (error) {
    return NextResponse.json({ data:null, error:{ message:error instanceof Error?error.message:"聊天记录加载失败" } }, { status:500 });
  }
}
