// app/actions/managers.ts
"use server";

import { withAction } from "@/lib/action-handlers";
import { registerManager } from "@/features/managers/services";

export const registerManagerAction = withAction(registerManager);