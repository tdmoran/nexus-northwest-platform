import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { JoinForm } from "./_components/JoinForm";

export default function LandingPage() {
  return (
    <>
      <SiteHeader />

      <main id="main">
        <Hero />
        <StatsStrip />
        <ValueProps />
        <JoinSection />
        <SiteFooter />
      </main>
    </>
  );
}

// --------------------------------------- header ---------------------------

function SiteHeader() {
  return (
    <header className="absolute inset-x-0 top-0 z-20">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-3 text-white/95 transition hover:text-white"
          aria-label="Nexus Northwest home"
        >
          <Image
            src="/logo.png"
            alt=""
            width={40}
            height={40}
            priority
            className="h-10 w-10 drop-shadow-[0_0_24px_rgba(46,163,154,0.5)]"
          />
          <span className="hidden text-sm font-semibold tracking-wide sm:inline">
            NEXUS NORTHWEST
          </span>
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-1 text-sm">
          <NavLink href="/events">Events</NavLink>
          <NavLink href="/community">Community</NavLink>
          <Link
            href="/login"
            className="ml-1 rounded-full border border-white/30 bg-white/10 px-4 py-1.5 font-semibold text-white backdrop-blur transition hover:border-white/60 hover:bg-white/20"
          >
            Sign in
          </Link>
        </nav>
      </div>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="hidden rounded-full px-3 py-1.5 font-medium text-white/80 transition hover:bg-white/10 hover:text-white sm:inline-block"
    >
      {children}
    </Link>
  );
}

// --------------------------------------- hero -----------------------------

function Hero() {
  return (
    <section className="relative isolate overflow-hidden bg-hero-gradient">
      <div className="hero-grid absolute inset-0" aria-hidden="true" />
      <div
        className="glow-blob a"
        aria-hidden="true"
        style={{ top: "-10%", left: "20%", width: "60vw", height: "60vw", background: "#2ea39a" }}
      />
      <div
        className="glow-blob b"
        aria-hidden="true"
        style={{ top: "20%", right: "5%", width: "40vw", height: "40vw", background: "#3a5a8a" }}
      />

      <div className="relative mx-auto max-w-4xl px-4 pb-24 pt-32 text-center sm:px-6 sm:pb-32 sm:pt-40">
        <div className="animate-fade-up flex justify-center">
          <Image
            src="/logo.png"
            alt="Nexus Northwest"
            width={180}
            height={180}
            priority
            className="h-32 w-32 drop-shadow-[0_0_40px_rgba(46,163,154,0.45)] sm:h-40 sm:w-40"
          />
        </div>

        <p
          className="animate-fade-up mt-8 inline-block rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-accent-300 backdrop-blur"
          style={{ animationDelay: "0.05s" }}
        >
          Sligo · Ireland · since 2014
        </p>

        <h1
          className="animate-fade-up mt-6 font-display text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-6xl"
          style={{ animationDelay: "0.1s" }}
        >
          Connecting people and ideas
          <br />
          <span className="bg-gradient-to-r from-accent-300 via-accent-400 to-accent-500 bg-clip-text text-transparent">
            shaping our future
          </span>{" "}
          and the world around us.
        </h1>

        <p
          className="animate-fade-up mx-auto mt-6 max-w-xl text-pretty text-base text-white/70 sm:text-lg"
          style={{ animationDelay: "0.15s" }}
        >
          The premier tech-focused networking community in Ireland&rsquo;s North&nbsp;West &mdash;
          a vibrant, cross-disciplinary ecosystem of talent and expertise.
        </p>

        <div
          className="animate-fade-up mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
          style={{ animationDelay: "0.2s" }}
        >
          <a
            href="#join"
            className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent-500 px-6 py-3 text-sm font-semibold text-white shadow-glow transition hover:bg-accent-400 sm:w-auto"
          >
            Join the community
            <span aria-hidden className="transition group-hover:translate-x-0.5">&rarr;</span>
          </a>
          <Link
            href="/events"
            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/25 bg-white/5 px-6 py-3 text-sm font-semibold text-white backdrop-blur transition hover:border-white/50 hover:bg-white/10 sm:w-auto"
          >
            See upcoming events
          </Link>
        </div>
      </div>
    </section>
  );
}

// --------------------------------------- stats ----------------------------

function StatsStrip() {
  const stats = [
    { value: "560+", label: "members" },
    { value: "10+", label: "years running" },
    { value: "Monthly", label: "meetups" },
    { value: "Free", label: "to join" }
  ];
  return (
    <section className="relative -mt-8 px-4 sm:-mt-12">
      <div className="mx-auto max-w-5xl rounded-3xl bg-white/95 p-6 shadow-card ring-1 ring-brand-100/70 backdrop-blur sm:p-8">
        <dl className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <dt className="text-xs font-semibold uppercase tracking-wider text-brand-300">
                {s.label}
              </dt>
              <dd className="mt-1 font-display text-3xl font-bold text-brand-800 sm:text-4xl">
                {s.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

// --------------------------------------- value props ----------------------

function ValueProps() {
  const items: Array<{ title: string; body: string; icon: React.ReactNode }> = [
    {
      title: "Real conversations",
      body:
        "In-person meetups in Sligo, plus a buzzing WhatsApp group for the in-betweens. Quality over volume.",
      icon: <IconChat />
    },
    {
      title: "One-click RSVP",
      body:
        "We email you when an event is announced. Tap a button to RSVP. No accounts, no chasing.",
      icon: <IconBolt />
    },
    {
      title: "You stay in control",
      body:
        "Email, WhatsApp, or both. Manage preferences any time from a private link &mdash; no login required.",
      icon: <IconShield />
    }
  ];

  return (
    <section className="bg-soft-gradient">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-600">
            Why join
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-brand-800 sm:text-4xl">
            Built for the way people actually meet.
          </h2>
          <p className="mt-4 text-base text-brand-600/80">
            We make it easy to show up, easy to leave, and respectful of your inbox in between.
          </p>
        </div>

        <ul className="mt-12 grid gap-6 sm:grid-cols-3">
          {items.map((item) => (
            <li
              key={item.title}
              className="group rounded-2xl bg-white p-6 shadow-card ring-1 ring-brand-100 transition hover:-translate-y-1 hover:ring-accent-300"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-50 text-accent-600 ring-1 ring-accent-100">
                {item.icon}
              </div>
              <h3 className="mt-5 font-display text-lg font-semibold text-brand-800">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-brand-600/85">{item.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// --------------------------------------- join section ---------------------

function JoinSection() {
  return (
    <section
      id="join"
      className="relative isolate overflow-hidden bg-brand-800 text-white"
    >
      <div
        className="glow-blob a"
        aria-hidden="true"
        style={{ top: "-30%", left: "60%", width: "40vw", height: "40vw", background: "#2ea39a" }}
      />
      <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-300">
            Join us
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold leading-tight sm:text-4xl">
            Two fields. Ten seconds. You&rsquo;re in.
          </h2>
          <p className="mt-4 max-w-md text-pretty text-white/70">
            We send one email per event with a one-click RSVP. Nothing else, ever. Unsubscribe with a
            single click any time.
          </p>

          <ul className="mt-6 space-y-3 text-sm text-white/80">
            <Bullet>No newsletters, no marketing blast lists</Bullet>
            <Bullet>GDPR-compliant — your data, your control</Bullet>
            <Bullet>Hosted in the EU on a non-profit footing</Bullet>
          </ul>
        </div>

        <div className="rounded-3xl bg-white p-6 text-brand-800 shadow-card ring-1 ring-white/10 sm:p-8">
          <Suspense fallback={<div className="h-72" aria-hidden="true" />}>
            <JoinForm />
          </Suspense>
        </div>
      </div>
    </section>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span
        aria-hidden="true"
        className="mt-1.5 inline-flex h-2 w-2 flex-none rounded-full bg-accent-400"
      />
      <span>{children}</span>
    </li>
  );
}

// --------------------------------------- footer ---------------------------

function SiteFooter() {
  return (
    <footer className="border-t border-brand-100 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3 text-brand-700">
          <Image src="/logo.png" alt="" width={28} height={28} className="h-7 w-7" />
          <span className="font-display text-sm font-semibold">Nexus Northwest</span>
        </div>
        <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-brand-600">
          <Link href="/events" className="hover:text-brand-800">Events</Link>
          <Link href="/community" className="hover:text-brand-800">Community</Link>
          <Link href="/privacy" className="hover:text-brand-800">Privacy</Link>
          <a href="mailto:hello@nexusnorthwest.org" className="hover:text-brand-800">
            hello@nexusnorthwest.org
          </a>
        </nav>
        <p className="text-xs text-brand-500">© {new Date().getFullYear()} Nexus Northwest</p>
      </div>
    </footer>
  );
}

// --------------------------------------- icons ----------------------------

function IconChat() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}
function IconBolt() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}
function IconShield() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
