interface EventFormValues {
  title?: string;
  description?: string;
  startsAt?: Date | null;
  endsAt?: Date | null;
  timezone?: string;
  location?: string;
  onlineUrl?: string | null;
  heroImageUrl?: string | null;
  capacity?: number | null;
  rsvpEnabled?: boolean;
  tags?: string[];
  reminderOffsets?: number[];
  reminderAudience?: "all" | "rsvp_yes";
}

function toDateInput(d: Date | null | undefined): string {
  if (!d) return "";
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 10); // YYYY-MM-DD
}

function toTimeInput(d: Date | null | undefined): string {
  if (!d) return "";
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(11, 16); // HH:MM
}

export function EventForm({
  action,
  initial,
  submitLabel
}: {
  action: (formData: FormData) => void;
  initial?: EventFormValues;
  submitLabel: string;
}) {
  const v = initial ?? {};
  return (
    <form action={action} className="space-y-4 rounded-xl bg-white p-6 ring-1 ring-slate-200">
      <Input label="Title" name="title" defaultValue={v.title ?? ""} required />
      <Textarea label="Description" name="description" rows={6} defaultValue={v.description ?? ""} required />

      <fieldset className="rounded-lg border border-slate-200 p-3">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Starts
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Date"
            name="startsAtDate"
            type="date"
            defaultValue={toDateInput(v.startsAt ?? null)}
            required
          />
          <Input
            label="Time"
            name="startsAtTime"
            type="time"
            defaultValue={toTimeInput(v.startsAt ?? null)}
            required
          />
        </div>
      </fieldset>

      <fieldset className="rounded-lg border border-slate-200 p-3">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Ends (optional)
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Date"
            name="endsAtDate"
            type="date"
            defaultValue={toDateInput(v.endsAt ?? null)}
          />
          <Input
            label="Time"
            name="endsAtTime"
            type="time"
            defaultValue={toTimeInput(v.endsAt ?? null)}
          />
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Timezone" name="timezone" defaultValue={v.timezone ?? "Europe/Dublin"} />
        <Input
          label="Capacity (optional)"
          name="capacity"
          type="number"
          min={1}
          defaultValue={v.capacity ?? ""}
        />
      </div>
      <Input label="Location" name="location" defaultValue={v.location ?? ""} required />
      <Input label="Online URL (optional)" name="onlineUrl" type="url" defaultValue={v.onlineUrl ?? ""} />
      <Input label="Hero image URL (optional)" name="heroImageUrl" type="url" defaultValue={v.heroImageUrl ?? ""} />
      <Input label="Tags (comma-separated)" name="tags" defaultValue={(v.tags ?? []).join(", ")} />
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="rsvpEnabled" defaultChecked={v.rsvpEnabled ?? true} /> Enable RSVP
      </label>
      <fieldset className="rounded-lg border border-slate-200 p-3">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Reminders
        </legend>
        <Input
          label="Send at (minutes before start, comma-separated)"
          name="reminderOffsets"
          defaultValue={(v.reminderOffsets ?? [10080, 1440, 120]).join(", ")}
        />
        <label className="mt-3 block">
          <span className="text-sm font-medium text-slate-700">Audience</span>
          <select
            name="reminderAudience"
            defaultValue={v.reminderAudience ?? "all"}
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          >
            <option value="all">All email-consenting members</option>
            <option value="rsvp_yes">Only members who RSVP&rsquo;d Yes</option>
          </select>
        </label>
      </fieldset>
      <button
        type="submit"
        className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
      >
        {submitLabel}
      </button>
    </form>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
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

function combine(date: string | undefined, time: string | undefined): string | undefined {
  if (!date) return undefined;
  // Default to 19:00 if time is missing — datetime needs both halves.
  const t = time && /^\d{2}:\d{2}$/.test(time) ? time : "19:00";
  return `${date}T${t}`;
}

export function readEventFormData(formData: FormData): {
  raw: Record<string, unknown>;
} {
  const str = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" && v.length > 0 ? v : undefined;
  };
  const offsets = (str("reminderOffsets") ?? "10080,1440,120")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n >= 0);

  const audienceRaw = str("reminderAudience") ?? "all";
  const reminderAudience: "all" | "rsvp_yes" =
    audienceRaw === "rsvp_yes" ? "rsvp_yes" : "all";

  const startsAt = combine(str("startsAtDate"), str("startsAtTime"));
  const endsAt = combine(str("endsAtDate"), str("endsAtTime"));

  return {
    raw: {
      title: str("title"),
      description: str("description"),
      startsAt,
      endsAt: endsAt ?? null,
      timezone: str("timezone") ?? "Europe/Dublin",
      location: str("location"),
      onlineUrl: str("onlineUrl") ?? null,
      heroImageUrl: str("heroImageUrl") ?? null,
      capacity: str("capacity") ?? null,
      rsvpEnabled: formData.get("rsvpEnabled") === "on",
      reminderOffsets: offsets.length > 0 ? offsets : [10080, 1440, 120],
      reminderAudience,
      tags: (str("tags") ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    }
  };
}
