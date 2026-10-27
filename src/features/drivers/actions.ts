// app/actions/drivers.ts
"use server";

import { withAction } from "@/lib/action-handlers";
import { registerDriver } from "@/features/drivers/services";

export const registerDriverAction = withAction(registerDriver);

// Client:
// const res = await registerDriverAction({ name, phone_number });
// if (!res.ok) return toast.error(res.error);
// res.data // the new driver row