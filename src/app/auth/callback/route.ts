import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");

  // Dynamically resolve the ngrok origin from headers
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  const baseOrigin = forwardedHost 
    ? `${forwardedProto}://${forwardedHost}` 
    : request.nextUrl.origin;

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type === "invite"
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "invite" })
      : { error: new Error("Invitation link is missing a valid verification token.") };

  console.log("Actual Request URL:", request.url);
  console.log("Resolved Base Origin:", baseOrigin);

  if (error) {
    console.error("Supabase Auth Error Details:", error.message);
    // Explicitly redirect to the ngrok address, avoiding localhost fallback
    return NextResponse.redirect(new URL("/auth/login?invite=invalid", baseOrigin));
  }

  return NextResponse.redirect(new URL("/auth/update-password", baseOrigin));
}

