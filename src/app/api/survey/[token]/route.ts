import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { lookupToken } from "@/lib/tokens";
import { audit } from "@/lib/audit";

const bodySchema = z.object({
  answers: z.record(z.string(), z.union([z.string(), z.number()])).optional().default({})
});

export async function POST(req: Request, { params }: { params: { token: string } }) {
  const lookup = await lookupToken(decodeURIComponent(params.token), "SURVEY_RESPONSE");
  if (!lookup || !lookup.eventId) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed" }, { status: 422 });

  const survey = await prisma.eventSurvey.findUnique({ where: { eventId: lookup.eventId } });
  if (!survey) return NextResponse.json({ error: "No survey for that event" }, { status: 404 });

  await prisma.eventSurveyResponse.upsert({
    where: { surveyId_memberId: { surveyId: survey.id, memberId: lookup.memberId } },
    update: { answers: parsed.data.answers, submittedAt: new Date() },
    create: {
      surveyId: survey.id,
      memberId: lookup.memberId,
      answers: parsed.data.answers
    }
  });

  await audit({
    action: "survey.responded",
    memberId: lookup.memberId,
    meta: { surveyId: survey.id, eventId: lookup.eventId }
  });

  return NextResponse.json({ ok: true });
}
