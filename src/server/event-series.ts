// Recurring event series.
//
// On each cron tick:
// 1. For every active series, count future Events tied to it.
// 2. While count < lookaheadCount, generate the next occurrence:
//    - Compute next start = max(latestEventStart, startsOn) + cadence step.
//    - Insert an Event row with the series template fields applied.
// 3. Stop once we've reached lookaheadCount or the next start would be > 1
//    year from now (sanity cap).

import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { log } from "@/lib/logger";
import { SeriesCadence, type EventSeries } from "@prisma/client";

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

function addCadence(d: Date, cadence: SeriesCadence): Date {
  const next = new Date(d);
  switch (cadence) {
    case "WEEKLY":
      next.setUTCDate(next.getUTCDate() + 7);
      return next;
    case "BIWEEKLY":
      next.setUTCDate(next.getUTCDate() + 14);
      return next;
    case "MONTHLY":
      next.setUTCMonth(next.getUTCMonth() + 1);
      return next;
  }
}

function applyLocalTime(d: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map((s) => Number(s));
  const out = new Date(d);
  out.setUTCHours(Number.isFinite(h) ? h : 19, Number.isFinite(m) ? m : 0, 0, 0);
  return out;
}

export async function materialiseSeriesOccurrences(now: Date = new Date()): Promise<{
  generated: number;
  scanned: number;
}> {
  const seriesList = await prisma.eventSeries.findMany({ where: { active: true } });
  let generated = 0;

  for (const series of seriesList) {
    const future = await prisma.event.findMany({
      where: { seriesId: series.id, startsAt: { gte: now } },
      orderBy: { startsAt: "desc" }
    });

    let needed = series.lookaheadCount - future.length;
    if (needed <= 0) continue;

    let lastStart = future[0]?.startsAt ?? null;

    while (needed > 0) {
      let nextStart: Date;
      if (lastStart) {
        nextStart = addCadence(lastStart, series.cadence);
      } else {
        // No occurrence yet — anchor at startsOn or today (whichever is later).
        const anchor = series.startsOn.getTime() > now.getTime() ? series.startsOn : now;
        nextStart = applyLocalTime(anchor, series.startTimeLocal);
      }
      // Ensure local-time is honoured even when stepping from an existing event.
      nextStart = applyLocalTime(nextStart, series.startTimeLocal);

      if (nextStart.getTime() > now.getTime() + ONE_YEAR_MS) break;
      if (nextStart.getTime() <= now.getTime()) {
        // Catch up — skip past dates without generating ghosts.
        lastStart = nextStart;
        continue;
      }

      try {
        await prisma.event.create({
          data: occurrencePayload(series, nextStart)
        });
        generated++;
        needed--;
        lastStart = nextStart;
      } catch (err) {
        log.error("event_series.create_failed", { seriesId: series.id, err: String(err) });
        break;
      }
    }

    if (generated > 0) {
      await audit({
        action: "event_series.materialised",
        meta: { seriesId: series.id, generated }
      });
    }
  }

  return { generated, scanned: seriesList.length };
}

function occurrencePayload(series: EventSeries, startsAt: Date) {
  const endsAt = new Date(startsAt.getTime() + series.durationMinutes * 60 * 1000);
  return {
    title: series.title,
    description: series.description,
    startsAt,
    endsAt,
    timezone: series.timezone,
    location: series.location,
    onlineUrl: series.onlineUrl,
    heroImageUrl: series.heroImageUrl,
    capacity: series.capacity,
    rsvpEnabled: true,
    reminderOffsets: series.reminderOffsets,
    reminderAudience: series.reminderAudience,
    tags: series.tags,
    seriesId: series.id,
    createdById: series.createdById
  };
}
