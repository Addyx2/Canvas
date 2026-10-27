import Link from "next/link";

import { hashSecret } from "@/lib/credentials";
import { prisma } from "@/lib/db";

import { AuthShell } from "../../AuthShell";
import { AcceptForm } from "./AcceptForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Join your team" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await prisma.invite.findUnique({ where: { tokenHash: hashSecret(token) }, include: { organization: true } });
  const valid = invite && !invite.acceptedAt && invite.expiresAt > new Date();
  return (
    <AuthShell>
      {valid ? (
        <>
          <h2 className="font-display text-2xl font-bold tracking-tight text-ink">Join {invite.organization.name}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {invite.invitedBy} invited you, {invite.name.split(" ")[0]}.{" "}
            {invite.role === "CARER" ? "You'll see your Peak points and can ask for rewards." : "You'll run Gateway and Peak with your team."}
          </p>
          <div className="mt-8"><AcceptForm token={token} email={invite.email} /></div>
        </>
      ) : (
        <>
          <h2 className="font-display text-2xl font-bold tracking-tight text-ink">This invite has ended</h2>
          <p className="mt-3 text-sm text-slate-600">It expired or was already used. Ask whoever invited you for a new link.</p>
        </>
      )}
      <p className="mt-8 text-center text-sm text-slate-500">
        Already have an account? <Link href="/login" className="font-semibold text-brand-700 hover:text-brand-800">Sign in</Link>
      </p>
    </AuthShell>
  );
}
