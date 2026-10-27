// lib/services/drivers.ts
import { supabase } from "@/lib/supabase"; // adjust to your server client
import { unwrap } from "@/lib/api-response-handlers";

export type RegisterDriverInput = {
  name: string;
  phone_number?: string | null;
};

export async function registerDriver(driverDetails: RegisterDriverInput) {
  const { name, phone_number } = driverDetails;

  // 3. Insert (duplicates are turned into a clear 409 by handleError)
  const result = await supabase
    .from("drivers")
    .insert({ name, phone_number })
    .select()
    .single();

  return unwrap({ result });
}