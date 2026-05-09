import type { InputHTMLAttributes, ReactNode } from "react";

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: ReactNode;
  error?: string;
}

export function Field({ label, hint, error, className = "", id, ...rest }: FieldProps) {
  const inputId = id ?? rest.name;
  return (
    <label htmlFor={inputId} className="block">
      <span className="text-sm font-medium text-brand-800">{label}</span>
      <input
        id={inputId}
        aria-invalid={Boolean(error) || undefined}
        {...rest}
        className={`mt-1.5 block w-full rounded-xl border border-brand-200 bg-white px-3.5 py-2.5 text-sm text-brand-800 shadow-sm transition placeholder:text-brand-300 focus:border-accent-400 focus:outline-none focus:ring-4 focus:ring-accent-100 ${error ? "border-rose-300 focus:border-rose-400 focus:ring-rose-100" : ""} ${className}`}
      />
      {hint && !error && <p className="mt-1.5 text-xs text-brand-500">{hint}</p>}
      {error && <p className="mt-1.5 text-xs text-rose-600">{error}</p>}
    </label>
  );
}
