"use client";

import { signIn } from "next-auth/react";

export function SsoButtons({ google, azure }: { google: boolean; azure: boolean }) {
  return (
    <div className="space-y-2">
      {google && (
        <button
          onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <GoogleIcon />
          Continue with Google
        </button>
      )}
      {azure && (
        <button
          onClick={() => signIn("azure-ad", { callbackUrl: "/dashboard" })}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <MicrosoftIcon />
          Continue with Microsoft
        </button>
      )}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8a12 12 0 1 1 0-24c3 0 5.7 1.1 7.8 3l5.7-5.7A20 20 0 1 0 24 44c11 0 20-9 20-20 0-1.2-.1-2.4-.4-3.5z"
      />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3 0 5.7 1.1 7.8 3l5.7-5.7A20 20 0 0 0 6.3 14.7z" />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 10-2 13.6-5.3l-6.3-5.2A12 12 0 0 1 12.7 28l-6.6 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.3 5.2c-.4.4 6.4-4.7 6.4-14.7 0-1.2-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 23 23" aria-hidden="true">
      <path fill="#f25022" d="M0 0h11v11H0z" />
      <path fill="#00a4ef" d="M0 12h11v11H0z" />
      <path fill="#7fba00" d="M12 0h11v11H12z" />
      <path fill="#ffb900" d="M12 12h11v11H12z" />
    </svg>
  );
}
