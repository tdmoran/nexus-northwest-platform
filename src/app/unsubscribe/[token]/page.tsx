import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { consumeToken } from "@/lib/tokens";
import { audit } from "@/lib/audit";

export default async function UnsubscribePage({ params }: { params: { token: string } }) {
  const tok = decodeURIComponent(params.token);
  const result = await consumeToken(tok, "UNSUBSCRIBE");
  if (!result) notFound();

  const member = await prisma.member.findUnique({ where: { id: result.memberId } });
  if (!member) notFound();

  await prisma.member.update({
    where: { id: member.id },
    data: {
      emailConsent: false,
      emailOptOutAt: new Date(),
      whatsappConsent: false,
      whatsappOptOutAt: new Date()
    }
  });

  await audit({
    action: "member.unsubscribed",
    memberId: member.id,
    channel: "email",
    meta: { method: "tokenized_link" }
  });

  return (
    <main id="main" className="mx-auto max-w-xl px-4 py-16">
      <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-xl font-bold text-slate-900">You&rsquo;ve been unsubscribed.</h1>
        <p className="mt-3 text-slate-600">
          We won&rsquo;t send you any more emails or WhatsApp messages. If this was a mistake, drop
          us a line and we&rsquo;ll get you re-added.
        </p>
      </div>
    </main>
  );
}
