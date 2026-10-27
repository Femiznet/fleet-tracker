// features/trucks/services/index.ts
import { supabase } from "@/lib/supabase";
import { unwrap } from "@/lib/api-response-handlers";

export type RegisterTruckInput = {
  plate_number: string;
};

export async function registerTruck(truckDetails: RegisterTruckInput) {
  const { plate_number } = truckDetails;

  const result = await supabase
    .from("trucks")
    .insert({ plate_number })
    .select()
    .single();

  return unwrap({ result });
}