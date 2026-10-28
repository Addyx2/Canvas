import { redirect } from "next/navigation";

import { Badge, Card, EmptyState, PageHeader, Td, Th } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CATEGORY_LABEL, OFFER_CATEGORIES } from "@/lib/peak/badges";
import { isAultrumStaff } from "@/lib/staff";

import { toggleOfferAction } from "./actions";
import { OfferForm } from "./OfferForm";

export const metadata = { title: "Partner offers" };
export const dynamic = "force-dynamic";

export default async function PartnerOffersPage() {
  const user = await requireUser();
  if (!(await isAultrumStaff(user))) redirect("/dashboard");
  const offers = await prisma.partnerOffer.findMany({ orderBy: [{ active: "desc" }, { createdAt: "desc" }], include: { _count: { select: { claims: true } } } });
  const now = new Date();

  return (
    <div className="space-y-6">
      <PageHeader title="Partner offers" description="Offers from Aultrum's partners, such as training discounts. Every carer on Peak sees them, in every organisation, and they don't cost points. Partners only ever see how many people opened an offer." />
      <Card className="p-5"><OfferForm categories={OFFER_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))} /></Card>
      {offers.length === 0 ? (
        <EmptyState title="No offers yet" description="Add the first one above. It appears on every carer's Peak straight away." />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead className="bg-slate-50"><tr><Th>Offer</Th><Th>Category</Th><Th>Code / link</Th><Th>Opened</Th><Th>Status</Th><Th /></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {offers.map((o) => {
                const ended = o.expiresAt && o.expiresAt < now;
                return (
                  <tr key={o.id}>
                    <Td><span className="font-medium text-slate-900">{o.partner}: {o.title}</span><p className="text-xs text-slate-500">{o.headline}{o.expiresAt ? ` · ends ${o.expiresAt.toLocaleDateString("en-GB")}` : ""}</p></Td>
                    <Td>{CATEGORY_LABEL[o.category as keyof typeof CATEGORY_LABEL] ?? o.category}</Td>
                    <Td><span className="font-mono text-xs">{o.code ?? "—"}</span>{o.url ? <p className="max-w-[220px] truncate text-xs text-slate-500">{o.url}</p> : null}</Td>
                    <Td className="tabular-nums">{o._count.claims}</Td>
                    <Td><Badge tone={ended ? "slate" : o.active ? "green" : "amber"}>{ended ? "Ended" : o.active ? "Live" : "Paused"}</Badge></Td>
                    <Td className="text-right">
                      <form action={toggleOfferAction}>
                        <input type="hidden" name="id" value={o.id} />
                        <button type="submit" className="text-sm font-medium text-brand-700 hover:text-brand-800">{o.active ? "Pause" : "Resume"}</button>
                      </form>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
