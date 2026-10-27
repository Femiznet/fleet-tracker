// app/actions/motormates.ts
"use server";

import { withAction } from "@/lib/action-handlers";
import { registerMotormate } from "@/features/motormates/services";

export const registerMotormateAction = withAction(registerMotormate);

// Client:
// const res = await registerMotormateAction({ name, phone_number });
// if (!res.ok) return toast.error(res.error);
// res.data // the new motormate row