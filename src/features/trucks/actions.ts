// app/actions/trucks.ts
"use server";

import { withAction } from "@/lib/action-handlers";
import { registerTruck } from "@/features/trucks/services";

export const registerTruckAction = withAction(registerTruck);