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
}

function toLocalInput(d: Date | null | undefined): string {
  if (!d) return "";
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
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
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Starts at"
          name="startsAt"
          type="datetime-local"
          defaultValue={toLocalInput(v.startsAt ?? null)}
          required
        />
        <Input
          label="Ends at (optional)"
          name="endsAt"
          type="datetime-local"
          defaultValue={toLocalInput(v.endsAt ?? null)}
        />
      </div>
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

export function readEventFormData(formData: FormData): {
  raw: Record<string, unknown>;
} {
  const str = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" && v.length > 0 ? v : undefined;
  };
  return {
    raw: {
      title: str("title"),
      description: str("description"),
      startsAt: str("startsAt"),
      endsAt: str("endsAt") ?? null,
      timezone: str("timezone") ?? "Europe/Dublin",
      location: str("location"),
      onlineUrl: str("onlineUrl") ?? null,
      heroImageUrl: str("heroImageUrl") ?? null,
      capacity: str("capacity") ?? null,
      rsvpEnabled: formData.get("rsvpEnabled") === "on",
      reminderOffsets: [10080, 1440, 120],
      tags: (str("tags") ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    }
  };
}
