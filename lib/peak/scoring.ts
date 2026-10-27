import type { Installation } from "@prisma/client";

import { prisma } from "../db";
import { addEntry, memberFor } from "./ledger";
import { readPeakSettings } from "./settings";

// Turns platform events into points. Every event names the person with the
// platform's own ID; the event's shift or praise ID stops double scoring.

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 200) : undefined;
}

export interface ScoreResult {
  scored: { kind: string; points: number }[];
  ignored?: string;
}

export async function scorePeakEvent(installation: Installation, type: string, data: Record<string, unknown>): Promise<ScoreResult> {
  const settings = readPeakSettings(installation.settings);
  const personId = text(data.personId);
  if (!personId) return { scored: [], ignored: "No personId" };
  const name = text(data.name);
  const member = await memberFor(installation.id, personId, name);
  const scored: ScoreResult["scored"] = [];
  const add = async (kind: Parameters<typeof addEntry>[0]["kind"], points: number, reason: string, sourceKey?: string) => {
    if (points <= 0) return;
    const entry = await addEntry({ installationId: installation.id, memberId: member.id, kind, points, reason, sourceKey });
    if (entry) scored.push({ kind, points });
  };

  switch (type) {
    case "platform.person.updated":
      return { scored };

    case "platform.shift.completed": {
      const shiftId = text(data.shiftId);
      const label = text(data.shiftName) ?? "a shift";
      await add("SHIFT", settings.shift, `Completed ${label}`, shiftId ? `shift:${shiftId}` : undefined);
      return { scored };
    }

    case "platform.clock.in": {
      const shiftId = text(data.shiftId);
      const minutesLate = typeof data.minutesLate === "number" ? data.minutesLate : data.late === true ? settings.graceMinutes + 1 : 0;
      const onTime = minutesLate <= settings.graceMinutes;
      if (shiftId && (await prisma.peakEntry.findUnique({ where: { installationId_sourceKey: { installationId: installation.id, sourceKey: `clock:${shiftId}` } } }))) {
        return { scored, ignored: "Already scored" };
      }
      if (!onTime) {
        await prisma.peakMember.update({ where: { id: member.id }, data: { streak: 0 } });
        return { scored, ignored: "Late, so no points and the streak resets" };
      }
      await add("ON_TIME", settings.onTime, "Clocked in on time", shiftId ? `clock:${shiftId}` : undefined);
      const { streak } = await prisma.peakMember.update({ where: { id: member.id }, data: { streak: { increment: 1 } } });
      if (settings.streakEvery > 0 && streak % settings.streakEvery === 0) {
        await add("STREAK", settings.streakBonus, `${streak} on-time clock-ins in a row`, shiftId ? `streak:${shiftId}` : undefined);
      }
      return { scored };
    }

    case "platform.praise.received": {
      const from = text(data.from) ?? "a client";
      const message = text(data.message);
      const praiseId = text(data.praiseId);
      await add("PRAISE", settings.praise, `Praise from ${from}${message ? `: “${message}”` : ""}`, praiseId ? `praise:${praiseId}` : undefined);
      return { scored };
    }
  }
  return { scored, ignored: `Peak doesn't score ${type}` };
}
