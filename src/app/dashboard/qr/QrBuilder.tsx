"use client";

import { useMemo, useState } from "react";

export function QrBuilder({ baseUrl }: { baseUrl: string }) {
  const [source, setSource] = useState("linkedin");
  const [medium, setMedium] = useState("social");
  const [campaign, setCampaign] = useState("");
  const [content, setContent] = useState("");
  const [referral, setReferral] = useState("");
  const [copied, setCopied] = useState(false);

  const trackedUrl = useMemo(() => {
    const u = new URL(baseUrl);
    if (source) u.searchParams.set("utm_source", source);
    if (medium) u.searchParams.set("utm_medium", medium);
    if (campaign) u.searchParams.set("utm_campaign", campaign);
    if (content) u.searchParams.set("utm_content", content);
    if (referral) u.searchParams.set("ref", referral);
    return u.toString();
  }, [baseUrl, source, medium, campaign, content, referral]);

  const qrSvgSrc = `/api/qr?url=${encodeURIComponent(trackedUrl)}&format=svg`;
  const qrPngSrc = `/api/qr?url=${encodeURIComponent(trackedUrl)}&format=png`;

  async function copyLink() {
    await navigator.clipboard.writeText(trackedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-xl bg-white p-6 ring-1 ring-slate-200">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Build link</h2>
        <div className="space-y-3">
          <Field label="Source (utm_source)" value={source} onChange={setSource} />
          <Field label="Medium (utm_medium)" value={medium} onChange={setMedium} />
          <Field
            label="Campaign (utm_campaign)"
            value={campaign}
            onChange={setCampaign}
            placeholder="march-meetup"
          />
          <Field
            label="Content (utm_content)"
            value={content}
            onChange={setContent}
            placeholder="badge | poster | post-1"
          />
          <Field
            label="Referral code (ref)"
            value={referral}
            onChange={setReferral}
            placeholder="e.g. organiser initials"
          />
        </div>

        <div className="mt-5 rounded-lg bg-slate-50 p-3 text-xs">
          <p className="font-mono break-all text-slate-700">{trackedUrl}</p>
          <button
            onClick={copyLink}
            className="mt-2 rounded-md bg-brand-600 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-700"
          >
            {copied ? "Copied!" : "Copy link"}
          </button>
        </div>
      </section>

      <section className="rounded-xl bg-white p-6 ring-1 ring-slate-200">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">QR code</h2>
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white p-3">
          {/* SVG fetched via the QR endpoint; rendered inline. */}
          <img src={qrSvgSrc} alt="Tracked QR" className="mx-auto h-auto w-full max-w-xs" />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href={qrSvgSrc}
            download="qr.svg"
            className="rounded-md bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700"
          >
            Download SVG
          </a>
          <a
            href={qrPngSrc}
            download="qr.png"
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Download PNG
          </a>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Generates a fresh QR each time the form changes. Sign-ups are attributed via the
          {" "}<code>utm_*</code> and <code>ref</code> params.
        </p>
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
      />
    </label>
  );
}
