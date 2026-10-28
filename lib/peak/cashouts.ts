import { prisma } from "../db";

// Approved cash-outs an organisation pays through its own payroll, when no
// connected system (such as Pleasant) pays them automatically.

export interface CashOutRow {
  id: string;
  name: string;
  email: string | null;
  amountPence: number;
  points: number;
  reward: string;
  approvedAt: Date | null;
  approvedBy: string | null;
  paidAt: Date | null;
  paidBy: string | null;
}

export async function cashOuts(installationId: string, organizationId: string, which: "unpaid" | "paid"): Promise<CashOutRow[]> {
  const rows = await prisma.peakRedemption.findMany({
    where: { installationId, kind: "CASH_OUT", status: "APPROVED", paidAt: which === "unpaid" ? null : { not: null } },
    orderBy: which === "unpaid" ? { decidedAt: "asc" } : { paidAt: "desc" },
    take: which === "unpaid" ? 500 : 20,
    include: { member: { select: { name: true, personId: true } } },
  });
  // Emails come from People, when Elements runs on its own.
  const people = await prisma.person.findMany({
    where: { organizationId, id: { in: rows.map((r) => r.member.personId) } },
    select: { id: true, email: true },
  });
  const email = new Map(people.map((p) => [p.id, p.email]));
  return rows.map((r) => ({
    id: r.id,
    name: r.member.name,
    email: email.get(r.member.personId) ?? null,
    amountPence: r.amountPence ?? 0,
    points: r.points,
    reward: r.rewardName,
    approvedAt: r.decidedAt,
    approvedBy: r.decidedBy,
    paidAt: r.paidAt,
    paidBy: r.paidBy,
  }));
}

/** A cell that can't be read as a formula by a spreadsheet, quoted for CSV. */
function cell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export function cashOutsCsv(rows: CashOutRow[]): string {
  const header = ["Name", "Email", "Amount (GBP)", "Points", "Reward", "Approved on", "Approved by", "Reference"];
  const lines = rows.map((r) => [r.name, r.email ?? "", (r.amountPence / 100).toFixed(2), String(r.points), r.reward, day(r.approvedAt), r.approvedBy ?? "", r.id].map(cell).join(","));
  return [header.map(cell).join(","), ...lines].join("\r\n") + "\r\n";
}

/** Marks approved, unpaid cash-outs as paid. Returns how many changed. */
export async function markPaid(installationId: string, ids: string[], by: string): Promise<number> {
  const result = await prisma.peakRedemption.updateMany({
    where: { installationId, id: { in: ids }, kind: "CASH_OUT", status: "APPROVED", paidAt: null },
    data: { paidAt: new Date(), paidBy: by },
  });
  return result.count;
}
