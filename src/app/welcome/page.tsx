export default function WelcomePage() {
  return (
    <main id="main" className="mx-auto max-w-2xl px-4 py-16">
      <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-2xl font-bold text-slate-900">You&rsquo;re in. Welcome.</h1>
        <p className="mt-3 text-slate-600">
          We&rsquo;ve sent you a welcome email with the next steps and links to manage your
          communication preferences. Looking forward to meeting you at the next event.
        </p>
        <a
          href="/"
          className="mt-6 inline-block text-sm font-semibold text-brand-600 hover:underline"
        >
          &larr; Back to home
        </a>
      </div>
    </main>
  );
}
