import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { can } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { DEFAULT_QUESTIONS, validateQuestions, type SurveyQuestion } from "@/server/surveys";

async function enableSurvey(formData: FormData) {
  "use server";
  const user = await requireUser();
  if (!can(user.role, "events.edit")) redirect("/dashboard?error=forbidden");
  const eventId = String(formData.get("eventId") ?? "");
  await prisma.eventSurvey.upsert({
    where: { eventId },
    update: { active: true },
    create: {
      eventId,
      questions: DEFAULT_QUESTIONS as unknown as object,
      active: true,
      createdById: user.id
    }
  });
  await audit({
    action: "survey.enabled",
    actorId: user.id,
    meta: { eventId }
  });
  redirect(`/dashboard/events/${eventId}/survey`);
}

async function pauseSurvey(formData: FormData) {
  "use server";
  const user = await requireUser();
  if (!can(user.role, "events.edit")) redirect("/dashboard?error=forbidden");
  const eventId = String(formData.get("eventId") ?? "");
  await prisma.eventSurvey.update({ where: { eventId }, data: { active: false } });
  await audit({
    action: "survey.paused",
    actorId: user.id,
    meta: { eventId }
  });
  redirect(`/dashboard/events/${eventId}/survey`);
}

export default async function EventSurveyPage({ params }: { params: { id: string } }) {
  await requireUser();
  const event = await prisma.event.findUnique({ where: { id: params.id } });
  if (!event) notFound();

  const survey = await prisma.eventSurvey.findUnique({
    where: { eventId: event.id },
    include: {
      responses: {
        include: { member: { select: { name: true, email: true } } },
        orderBy: { submittedAt: "desc" }
      }
    }
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Post-event survey</h1>
        <p className="text-sm text-slate-600">{event.title}</p>
      </header>

      {survey ? (
        <SurveyDetail survey={survey} eventId={event.id} />
      ) : (
        <div className="rounded-xl bg-white p-6 ring-1 ring-slate-200">
          <p className="text-sm text-slate-700">
            No survey yet. Enable one and the platform will email every RSVP-Yes member 24 hours
            after the event ends. Responses are token-protected and one-per-member.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Default questions: overall rating (1-5), highlight, what to improve.
          </p>
          <form action={enableSurvey} className="mt-4">
            <input type="hidden" name="eventId" value={event.id} />
            <button
              type="submit"
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Enable survey
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function SurveyDetail({
  survey,
  eventId
}: {
  survey: {
    id: string;
    questions: unknown;
    active: boolean;
    dispatchedAt: Date | null;
    responses: Array<{
      id: string;
      answers: unknown;
      submittedAt: Date;
      member: { name: string; email: string };
    }>;
  };
  eventId: string;
}) {
  const questions = validateQuestions(survey.questions);
  const ratings = ratingDistribution(questions, survey.responses);

  return (
    <>
      <section className="grid gap-4 sm:grid-cols-3">
        <Stat label="Status" value={survey.active ? "active" : "paused"} />
        <Stat
          label="Dispatched"
          value={
            survey.dispatchedAt
              ? survey.dispatchedAt.toLocaleString("en-IE", {
                  dateStyle: "short",
                  timeStyle: "short"
                })
              : "pending"
          }
        />
        <Stat label="Responses" value={String(survey.responses.length)} />
      </section>

      <section className="rounded-xl bg-white p-6 ring-1 ring-slate-200">
        <h2 className="text-sm font-semibold text-slate-900">Questions</h2>
        <ol className="mt-2 list-decimal pl-5 text-sm text-slate-700">
          {questions.map((q) => (
            <li key={q.id} className="mt-1">
              {q.prompt}{" "}
              <span className="text-xs text-slate-500">({q.kind})</span>
            </li>
          ))}
        </ol>
      </section>

      {ratings.length > 0 && (
        <section className="rounded-xl bg-white p-6 ring-1 ring-slate-200">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Rating questions</h2>
          {ratings.map((r) => (
            <div key={r.questionId} className="mb-4 last:mb-0">
              <p className="text-sm font-medium text-slate-700">{r.prompt}</p>
              <p className="text-xs text-slate-500">
                Mean: {r.mean.toFixed(2)} &middot; n = {r.count}
              </p>
              <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-slate-100">
                {r.distribution.map((count, i) => {
                  const pct = r.count === 0 ? 0 : (count / r.count) * 100;
                  return (
                    <div
                      key={i}
                      title={`${i + 1}: ${count}`}
                      style={{ width: `${pct}%`, backgroundColor: ratingColour(i + 1) }}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="rounded-xl bg-white ring-1 ring-slate-200">
        <h2 className="px-6 pt-5 text-sm font-semibold text-slate-900">Responses</h2>
        {survey.responses.length === 0 ? (
          <p className="px-6 py-4 text-sm text-slate-500">No responses yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100 px-6 py-2 text-sm">
            {survey.responses.map((r) => (
              <li key={r.id} className="py-3">
                <p className="text-xs text-slate-500">
                  {r.member.name} &middot; {r.submittedAt.toLocaleString("en-IE")}
                </p>
                <dl className="mt-1 space-y-1">
                  {Object.entries((r.answers ?? {}) as Record<string, string | number>).map(
                    ([qid, val]) => {
                      const q = questions.find((x) => x.id === qid);
                      return (
                        <div key={qid} className="text-sm">
                          <dt className="font-medium text-slate-700">{q?.prompt ?? qid}</dt>
                          <dd className="text-slate-600">{String(val)}</dd>
                        </div>
                      );
                    }
                  )}
                </dl>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form action={survey.active ? pauseSurvey : enableSurvey}>
        <input type="hidden" name="eventId" value={eventId} />
        <button
          type="submit"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          {survey.active ? "Pause survey" : "Resume survey"}
        </button>
      </form>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function ratingDistribution(
  questions: SurveyQuestion[],
  responses: Array<{ answers: unknown }>
): Array<{ questionId: string; prompt: string; distribution: number[]; count: number; mean: number }> {
  const out: ReturnType<typeof ratingDistribution> = [];
  for (const q of questions) {
    if (q.kind !== "rating") continue;
    const dist = [0, 0, 0, 0, 0];
    let sum = 0;
    let n = 0;
    for (const r of responses) {
      const v = (r.answers as Record<string, unknown> | null)?.[q.id];
      const num = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
      if (Number.isFinite(num) && num >= 1 && num <= 5) {
        dist[Math.floor(num) - 1]++;
        sum += num;
        n++;
      }
    }
    out.push({
      questionId: q.id,
      prompt: q.prompt,
      distribution: dist,
      count: n,
      mean: n === 0 ? 0 : sum / n
    });
  }
  return out;
}

function ratingColour(rating: number): string {
  switch (rating) {
    case 1: return "#dc2626";
    case 2: return "#ea580c";
    case 3: return "#ca8a04";
    case 4: return "#65a30d";
    case 5: return "#16a34a";
    default: return "#94a3b8";
  }
}
