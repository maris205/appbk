import { NextResponse } from "next/server";
import { getUserFromToken, readSessionCookie } from "../../../../../lib/auth";

export async function GET(request: Request) {
  const user = await getUserFromToken(readSessionCookie(request));
  return NextResponse.json({ data: user, error: null });
}
