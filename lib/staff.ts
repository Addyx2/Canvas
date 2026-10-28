import { prisma } from "./db";

/**
 * Aultrum's own team, who manage things shared by every organisation, such as
 * partner offers. Either listed in AULTRUM_STAFF_EMAILS, or using an
 * @aultrum.co.uk address they have proved is theirs by opening an emailed link.
 */
export async function isAultrumStaff(user: { id: string; email: string; emailVerified: boolean }): Promise<boolean> {
  const listed = (process.env.AULTRUM_STAFF_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (listed.includes(user.email.toLowerCase())) return true;
  if (!user.email.toLowerCase().endsWith("@aultrum.co.uk") || !user.emailVerified) return false;
  // Accounts made before email verification existed count as verified, so ask for proof.
  const proof = await prisma.authToken.findFirst({ where: { userId: user.id, usedAt: { not: null } }, select: { id: true } });
  return Boolean(proof);
}
