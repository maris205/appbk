import { NextResponse } from "next/server";
import { getUserFromToken, readSessionCookie } from "../../../../lib/auth";
import { listConversations } from "../../../../lib/chat-history";

export async function GET(request: Request) {
  const user = await getUserFromToken(readSessionCookie(request));
  if (!user) return NextResponse.json({ data:null, error:{ message:"请先登录" } }, { status:401 });
  try {
    return NextResponse.json({ data:await listConversations(user.id), error:null });
  } catch (error) {
    return NextResponse.json({ data:null, error:{ message:error instanceof Error?error.message:"聊天记录加载失败" } }, { status:500 });
  }
}
