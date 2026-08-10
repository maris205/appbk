import { NextResponse } from "next/server";
import { createSession, isValidEmail, registerUser, sessionCookie } from "../../../../../lib/auth";

export async function POST(request: Request) {
  try {
    const { email = "", password = "" } = await request.json();
    if (!isValidEmail(email)) return NextResponse.json({ error: { message: "请输入有效的邮箱地址" } }, { status: 400 });
    if (typeof password !== "string" || password.length < 8 || password.length > 128) return NextResponse.json({ error: { message: "密码需要 8 至 128 个字符" } }, { status: 400 });
    const user = await registerUser(email, password);
    const session = await createSession(user.id);
    return NextResponse.json({ data: user, error: null }, { status: 201, headers: { "Set-Cookie": sessionCookie(session.token, session.expiresAt) } });
  } catch (error) {
    return NextResponse.json({ error: { message: error instanceof Error ? error.message : "注册失败，请稍后重试" } }, { status: 409 });
  }
}
