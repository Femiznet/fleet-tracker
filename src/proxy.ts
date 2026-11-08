import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );

          response = NextResponse.next({ request });

          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  console.log(user);
  
  const isLogin = request.nextUrl.pathname === "/auth/login";

  if (!user) {
    if (isLogin) return response;

    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  const destination =
    profile.role === "admin" ? "/admin/dashboard" : "/customer/dashboard";

  if (isLogin || request.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL(destination, request.url));
  }

  if (
    profile.role === "customer" &&
    request.nextUrl.pathname.startsWith("/admin")
  ) {
    return NextResponse.redirect(new URL("/customer/dashboard", request.url));
  }

  if (
    profile.role === "admin" &&
    request.nextUrl.pathname.startsWith("/customer")
  ) {
    return NextResponse.redirect(new URL("/admin/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/",
    "/admin/:path*",
    "/customer/:path*",
    "/auth/login",
    "/auth/update-password",
  ],
};