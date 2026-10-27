// lib/services/motormates.ts
import { supabase } from "@/lib/supabase";
import { unwrap } from "@/lib/api-response-handlers";

export type RegisterMotormateInput = {
  name: string;
  phone_number?: string | null;
};

export async function registerMotormate(
  motormateDetails: RegisterMotormateInput
) {
  const { name, phone_number } = motormateDetails;

  const result = await supabase
    .from("motormates")
    .insert({ name, phone_number })
    .select()
    .single();

  return unwrap({ result });
}