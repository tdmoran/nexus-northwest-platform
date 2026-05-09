import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { lookupToken } from "@/lib/tokens";
import { validateQuestions } from "@/server/surveys";
import { SurveyForm } from "./SurveyForm";

export default async function SurveyPage({ params }: { params: { token: string } }) {
  const token = decodeURIComponent(params.token);
  const lookup = await lookupToken(token, "SURVEY_RESPONSE");
  if (!lookup || !lookup.eventId) notFound();

  const event = await prisma.event.findUnique({ where: { id: lookup.eventId } });
  const survey = await prisma.eventSurvey.findUnique({ where: { eventId: lookup.eventId } });
  const member = await prisma.member.findUnique({ where: { id: lookup.memberId } });
  if (!event || !survey || !member) notFound();

  const existing = await prisma.eventSurveyResponse.findUnique({
    where: { surveyId_memberId: { surveyId: survey.id, memberId: member.id } }
  });

  const questions = validateQuestions(survey.questions);

  return (
    <main id="main" className="mx-auto max-w-xl px-4 py-12">
      <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">Feedback</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">{event.title}</h1>
        <p className="mt-2 text-sm text-slate-600">
          Thanks for coming, {member.name}. A minute of your time helps us shape the next one.
        </p>

        {existing ? (
          <p className="mt-6 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            You&rsquo;ve already submitted feedback for this event &mdash; thank you.
          </p>
        ) : (
          <SurveyForm token={token} questions={questions} />
        )}
      </div>
    </main>
  );
}
