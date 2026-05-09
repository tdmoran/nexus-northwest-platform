import { redirect } from "next/navigation";
import { requireCapability } from "@/lib/session";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { materialiseSeriesOccurrences } from "@/server/event-series";

async function createSeries(formData: FormData) {
  "use server";
  const user = await requireCapability("events.edit");
  const str = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" && v.length > 0 ? v.trim() : undefined;
  };
  const title = str("title");
  const description = str("description") ?? "";
  const cadence = (str("cadence") ?? "MONTHLY") as "WEEKLY" | "BIWEEKLY" | "MONTHLY";
  const startTimeLocal = str("startTimeLocal") ?? "19:00";
  const durationMinutes = Number(str("durationMinutes") ?? "120");
  const location = str("location");
  const startsOn = str("startsOn");
  if (!title || !location || !startsOn) {
    throw new Error("Title, location, and start date are required");
  }
  const series = await prisma.eventSeries.create({
    data: {
      title,
      description,
      cadence,
      startTimeLocal,
      durationMinutes,
      location,
      startsOn: new Date(startsOn),
      lookaheadCount: Number(str("lookaheadCount") ?? "2"),
      timezone: str("timezone") ?? "Europe/Dublin",
      tags: (str("tags") ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      createdById: user.id
    }
  });
  await audit({
    action: "event_series.created",
    actorId: user.id,
    meta: { seriesId: series.id, title }
  });
  // Generate the first lookahead occurrences immediately so the new series is
  // visible right away rather than waiting for the cron.
  await materialiseSeriesOccurrences();
  redirect(`/dashboard/series/${series.id}`);
}

export default async function NewSeriesPage() {
  await requireCapability("events.edit");
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">New event series</h1>
      <form
        action={createSeries}
        className="space-y-4 rounded-xl bg-white p-6 ring-1 ring-slate-200"
      >
        <Field name="title" label="Series title" required />
        <Textarea name="description" label="Description" rows={4} required />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            name="cadence"
            label="Cadence"
            options={[
              ["WEEKLY", "Weekly"],
              ["BIWEEKLY", "Every 2 weeks"],
              ["MONTHLY", "Monthly"]
            ]}
          />
          <Field name="startTimeLocal" label="Start time (HH:MM)" defaultValue="19:00" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            name="durationMinutes"
            label="Duration (minutes)"
            type="number"
            min={15}
            defaultValue={120}
          />
          <Field name="lookaheadCount" label="Look-ahead occurrences" type="number" min={1} defaultValue={2} />
        </div>
        <Field name="location" label="Location" required />
        <Field name="startsOn" label="First occurrence (date)" type="date" required />
        <Field name="timezone" label="Timezone" defaultValue="Europe/Dublin" />
        <Field name="tags" label="Tags (comma-separated)" />
        <button
          type="submit"
          className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Create series
        </button>
      </form>
    </div>
  );
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...rest } = props;
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        {...rest}
        className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
      />
    </label>
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  const { label, ...rest } = props;
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <textarea
        {...rest}
        className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
      />
    </label>
  );
}

function Select({
  name,
  label,
  options
}: {
  name: string;
  label: string;
  options: Array<[string, string]>;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <select
        name={name}
        className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
      >
        {options.map(([v, label]) => (
          <option key={v} value={v}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}
