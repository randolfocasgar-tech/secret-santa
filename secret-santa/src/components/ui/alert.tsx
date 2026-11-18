import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "error" | "success" | "info" | "warning";

const tones: Record<Tone, string> = {
  error: "border-berry-100 bg-berry-50 text-berry-700",
  success: "border-pine-100 bg-pine-50 text-pine-800",
  info: "border-line bg-card text-ink",
  warning: "border-[#eadbb4] bg-gold-100 text-[#6b4f0f]",
};

const icons: Record<Tone, ReactNode> = {
  error: <path d="M12 8v5m0 3h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />,
  warning: <path d="M12 8v5m0 3h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />,
  success: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  info: <path d="M12 16v-4m0-4h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z" />,
};

export function Alert({
  tone = "info",
  title,
  children,
  className,
  live = true,
}: {
  tone?: Tone;
  title?: string;
  children?: ReactNode;
  className?: string;
  live?: boolean;
}) {
  const role = live ? (tone === "error" ? "alert" : "status") : undefined;
  return (
    <div role={role} className={cn("flex gap-3 rounded-xl border px-4 py-3 text-sm", tones[tone], className)}>
      <svg
        viewBox="0 0 24 24"
        className="mt-0.5 size-5 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {icons[tone]}
      </svg>
      <div className="min-w-0 space-y-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className="leading-relaxed">{children}</div> : null}
      </div>
    </div>
  );
}
