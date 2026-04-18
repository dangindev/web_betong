import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = (await request.json()) as { locale?: string };
  const locale = body.locale === "en" ? "en" : "vi";

  const response = NextResponse.json({ status: "ok", locale });
  response.cookies.set("locale", locale, {
    httpOnly: false,
    sameSite: "lax",
    path: "/"
  });

  return response;
}
