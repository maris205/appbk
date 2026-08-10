import { NextResponse } from "next/server";
import { clearSessionCookie, deleteSession, readSessionCookie } from "../../../../../lib/auth";

export async function POST(request: Request) {
  await deleteSession(readSessionCookie(request));
  return NextResponse.json({ data: { success: true }, error: null }, { headers: { "Set-Cookie": clearSessionCookie() } });
}
