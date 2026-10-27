// features/managers/services/index.ts
import { supabase } from "@/lib/supabase";
import { unwrap } from "@/lib/api-response-handlers";

export type RegisterManagerInput = {
  name: string;
};

export async function registerManager(managerDetails: RegisterManagerInput) {
  const { name } = managerDetails;

  const result = await supabase
    .from("managers")
    .insert({ name })
    .select()
    .single();

  return unwrap({ result });
}