import { z } from "zod";

// How an installation of Peak scores. Stored in Installation.settings.peak so
// each service (e.g. one agency in Pleasant) can tune its own rules.

export const peakSettingsSchema = z.object({
  /** Points for each completed shift. */
  shift: z.coerce.number().int().min(0).max(1000).default(10),
  /** Points for clocking in on time (within the grace period). */
  onTime: z.coerce.number().int().min(0).max(1000).default(5),
  /** Minutes after the start time that still count as on time. */
  graceMinutes: z.coerce.number().int().min(0).max(60).default(5),
  /** A bonus every this many on-time clock-ins in a row (0 turns streaks off). */
  streakEvery: z.coerce.number().int().min(0).max(100).default(5),
  streakBonus: z.coerce.number().int().min(0).max(5000).default(25),
  /** Points for praise from a client or manager. */
  praise: z.coerce.number().int().min(0).max(1000).default(15),
  /** What one point is worth when cashed out, in pence. 1 means 100 points = £1. */
  pointValuePence: z.coerce.number().int().min(0).max(100).default(1),
});

export type PeakSettings = z.infer<typeof peakSettingsSchema>;

export function readPeakSettings(settings: unknown): PeakSettings {
  const raw = settings && typeof settings === "object" ? (settings as { peak?: unknown }).peak : undefined;
  const parsed = peakSettingsSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : peakSettingsSchema.parse({});
}

/** Rewards a new installation starts with; managers can change them in the console. */
export const DEFAULT_REWARDS = [
  { name: "Cash out £5", description: "Paid to you once your manager approves it.", kind: "CASH_OUT" as const, cost: 500 },
  { name: "Cash out £20", description: "Paid to you once your manager approves it.", kind: "CASH_OUT" as const, cost: 2000 },
  { name: "£10 shopping voucher", description: "Sent to you by your manager.", kind: "PERK" as const, cost: 1000 },
  { name: "Choose your shifts first next week", description: "First pick of next week's open shifts.", kind: "PERK" as const, cost: 750 },
];

export function formatPence(pence: number): string {
  return `£${(pence / 100).toFixed(2).replace(/\.00$/, "")}`;
}
