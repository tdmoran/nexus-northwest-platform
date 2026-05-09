import { JoinForm } from "./_components/JoinForm";

export default function LandingPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
      <header className="mb-10 sm:mb-14">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">
          Nexus Northwest
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Join a community building, learning and connecting together.
        </h1>
        <p className="mt-4 text-lg text-slate-600">
          We meet in person, share ideas, and help each other ship. Sign up takes ten seconds &mdash;
          name, email, and a tick to confirm you&rsquo;re happy to hear from us.
        </p>
      </header>

      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
        <JoinForm />
      </section>

      <section className="mt-10 grid gap-6 sm:grid-cols-3">
        <Feature
          title="One email per event"
          body="No newsletters, no spam. Just the upcoming event, with a one-click RSVP."
        />
        <Feature
          title="WhatsApp optional"
          body="Prefer chat? Opt in for a broadcast-only WhatsApp announcement instead."
        />
        <Feature
          title="No account needed"
          body="Manage your preferences any time from a tokenised link &mdash; no login required."
        />
      </section>

      <footer className="mt-14 flex flex-col gap-2 border-t border-slate-200 pt-6 text-sm text-slate-500 sm:flex-row sm:justify-between">
        <p>&copy; {new Date().getFullYear()} Nexus Northwest</p>
        <p>
          By joining you agree to our{" "}
          <a className="text-brand-600 underline" href="/privacy">
            privacy policy
          </a>
          .
        </p>
      </footer>
    </main>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl bg-white p-5 ring-1 ring-slate-200">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-600">{body}</p>
    </div>
  );
}
