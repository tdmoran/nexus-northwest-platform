import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { consumeToken } from "@/lib/tokens";
import { audit } from "@/lib/audit";
import { TokenPageShell } from "@/components/layout/PublicShell";

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
    <TokenPageShell
      eyebrow="Unsubscribed"
      title="You're off the list."
      subtitle="We won't send you any more emails or WhatsApp messages."
      size="md"
    >
      <p className="text-sm text-brand-600">
        If this was a mistake,{" "}
        <a
          href="mailto:hello@nexusnorthwest.org"
          className="font-semibold text-brand-700 underline-offset-2 hover:text-brand-800 hover:underline"
        >
          drop us a line
        </a>{" "}
        and we&rsquo;ll get you re-added.
      </p>
    </TokenPageShell>
  );
}
