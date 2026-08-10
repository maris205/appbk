import { NextResponse } from "next/server";
import { createSession, sessionCookie, verifyUser } from "../../../../../lib/auth";

export async function POST(request: Request) {
  try {
    const { email = "", password = "" } = await request.json();
    const user = await verifyUser(email, password);
    if (!user) return NextResponse.json({ error: { message: "邮箱或密码不正确" } }, { status: 401 });
    const session = await createSession(user.id);
    return NextResponse.json({ data: user, error: null }, { headers: { "Set-Cookie": sessionCookie(session.token, session.expiresAt) } });
  } catch {
    return NextResponse.json({ error: { message: "登录失败，请稍后重试" } }, { status: 500 });
  }
}
