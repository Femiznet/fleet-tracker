// lib/services/skids.ts
import { supabase } from "@/lib/supabase";
import { unwrap } from "@/lib/api-response-handlers";

export type RegisterSkidInput = {
  skid_no: string;
};

export async function registerSkid(skidDetails: RegisterSkidInput) {
  const { skid_no } = skidDetails;

  const result = await supabase
    .from("skids")
    .insert({ skid_no })
    .select()
    .single();

  return unwrap({ result });
}