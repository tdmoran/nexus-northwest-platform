import { forwardRef, type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "accent";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-gradient-to-b from-brand-700 to-brand-800 text-white shadow-card hover:from-brand-600 hover:to-brand-700 focus-visible:ring-brand-400",
  accent:
    "bg-gradient-to-b from-accent-400 to-accent-600 text-white shadow-glow hover:from-accent-300 hover:to-accent-500 focus-visible:ring-accent-400",
  secondary:
    "bg-white text-brand-800 border border-brand-200 hover:border-brand-300 hover:bg-brand-50 focus-visible:ring-brand-400",
  ghost:
    "bg-transparent text-brand-700 hover:bg-brand-50 focus-visible:ring-brand-300",
  danger:
    "bg-gradient-to-b from-rose-500 to-rose-600 text-white shadow-card hover:from-rose-400 hover:to-rose-500 focus-visible:ring-rose-400"
};

const sizes: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2.5 text-sm",
  lg: "px-6 py-3 text-base"
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", className = "", ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center gap-1.5 rounded-full font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:opacity-60 disabled:pointer-events-none ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    />
  );
});
