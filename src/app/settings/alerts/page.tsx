import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import AlertForm from "./AlertForm";

export const dynamic = "force-dynamic";

export default async function AlertSettingsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: prefs } = await supabase
    .from("alert_preferences")
    .select("dashboard_alerts, whatsapp_alerts, whatsapp_number")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Alert settings</h1>
      <p className="mt-1 mb-6 text-sm text-slate-600">
        You only get alerts you turn on here.
      </p>
      <AlertForm
        dashboardAlerts={prefs?.dashboard_alerts ?? false}
        whatsappAlerts={prefs?.whatsapp_alerts ?? false}
        whatsappNumber={prefs?.whatsapp_number ?? ""}
      />
    </main>
  );
}