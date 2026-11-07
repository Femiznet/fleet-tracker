import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type === "invite"
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "invite" })
      : { error: new Error("Invitation link is missing a valid verification token.") };

  if (error) {
    return NextResponse.redirect(new URL("/login?invite=invalid", request.url));
  }

  return NextResponse.redirect(new URL("/auth/update-password", request.url));
}
