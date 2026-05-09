// Post-event surveys.
//
// Question schema (kept tiny):
//   { id: string, prompt: string, kind: "rating" | "text" | "choice", choices?: string[] }
//
// dispatchPostEventSurveys runs hourly. For every active survey on an event
// that ended >= 24h ago and hasn't been dispatched yet, it emails every
// attended member (RSVP=YES with attendedAt OR RSVP=YES if no check-in
// happened) a tokenised response link.

import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { issueToken } from "@/lib/tokens";
import { publicUrl } from "@/lib/urls";
import { env } from "@/lib/env";
import { log } from "@/lib/logger";

export interface SurveyQuestion {
  id: string;
  prompt: string;
  kind: "rating" | "text" | "choice";
  choices?: string[];
}

export const DEFAULT_QUESTIONS: SurveyQuestion[] = [
  { id: "overall", prompt: "Overall, how would you rate the event?", kind: "rating" },
  { id: "highlights", prompt: "What was the highlight for you?", kind: "text" },
  { id: "improvements", prompt: "What could we improve next time?", kind: "text" }
];

export function validateQuestions(qs: unknown): SurveyQuestion[] {
  if (!Array.isArray(qs) || qs.length === 0) return DEFAULT_QUESTIONS;
  const out: SurveyQuestion[] = [];
  for (const raw of qs) {
    if (typeof raw !== "object" || raw == null) continue;
    const q = raw as Record<string, unknown>;
    if (typeof q.id !== "string" || typeof q.prompt !== "string") continue;
    const kind = q.kind === "rating" || q.kind === "text" || q.kind === "choice" ? q.kind : "text";
    const choices = Array.isArray(q.choices) ? (q.choices as string[]).filter((c) => typeof c === "string") : undefined;
    out.push({ id: q.id, prompt: q.prompt, kind, choices });
  }
  return out.length > 0 ? out : DEFAULT_QUESTIONS;
}

export async function dispatchPostEventSurveys(now: Date = new Date()): Promise<{
  scanned: number;
  dispatched: number;
}> {
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const surveys = await prisma.eventSurvey.findMany({
    where: {
      active: true,
      dispatchedAt: null,
      event: { endsAt: { lte: cutoff } }
    },
    include: { event: true }
  });

  let dispatched = 0;
  for (const survey of surveys) {
    try {
      const recipients = await prisma.member.findMany({
        where: {
          emailConsent: true,
          emailOptOutAt: null,
          deletionRequestedAt: null,
          deletedAt: null,
          rsvps: { some: { eventId: survey.event.id, status: "YES" } }
        }
      });

      for (const member of recipients) {
        try {
          const token = await issueToken({
            memberId: member.id,
            purpose: "SURVEY_RESPONSE",
            eventId: survey.event.id,
            ttlMinutes: 30 * 24 * 60 // 30-day window to respond
          });
          const surveyUrl = publicUrl(`/survey/${encodeURIComponent(token)}`);
          const html = `
            <p>Hi ${escapeHtml(member.name)},</p>
            <p>Thanks for coming to <strong>${escapeHtml(survey.event.title)}</strong>. Could you spare a minute to tell us how it went?</p>
            <p><a href="${surveyUrl}">Take the survey (1 min)</a></p>
            <p>Your feedback shapes the next event. The link is one-click — no login required.</p>
          `;
          await sendEmail({
            to: member.email,
            subject: `How was ${survey.event.title}?`,
            html
          });
        } catch (err) {
          log.error("survey.dispatch.member_failed", {
            surveyId: survey.id,
            memberId: member.id,
            err: String(err)
          });
        }
      }

      await prisma.eventSurvey.update({
        where: { id: survey.id },
        data: { dispatchedAt: now }
      });
      await audit({
        action: "survey.dispatched",
        meta: {
          surveyId: survey.id,
          eventId: survey.event.id,
          recipients: recipients.length
        }
      });
      dispatched++;
    } catch (err) {
      log.error("survey.dispatch.failed", { surveyId: survey.id, err: String(err) });
    }
  }

  return { scanned: surveys.length, dispatched };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
