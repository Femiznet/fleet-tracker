import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function requireAdmin() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (
    error ||
    !user ||
    user.email?.toLowerCase() !== process.env.ADMIN_EMAIL?.toLowerCase()
  ) {
    throw new Error("Unauthorized");
  }

  return user;
}