import { z } from 'zod';

export const OfficerAlertRouteSchema = z.enum([
  'tracker',
  'movements',
  'updates',
  'plant-report',
  'dispatch',
]);

export const OfficerAlertSchema = z.object({
  id: z.string(),
  route: OfficerAlertRouteSchema,
  href: z.string(),
  title: z.string(),
  description: z.string(),
  count: z.number().int().nonnegative(),
  severity: z.enum(['critical', 'warning', 'info']),
});

export const OfficerAlertsResponseSchema = z.object({
  data: z.object({
    alerts: z.array(OfficerAlertSchema),
    routeCounts: z.record(OfficerAlertRouteSchema, z.number().int().nonnegative()),
    total: z.number().int().nonnegative(),
  }),
});

export type OfficerAlertRoute = z.infer<typeof OfficerAlertRouteSchema>;
export type OfficerAlert = z.infer<typeof OfficerAlertSchema>;
export type OfficerAlerts = z.infer<typeof OfficerAlertsResponseSchema>['data'];
