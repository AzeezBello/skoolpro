import { cn } from "@/lib/utils";

const palette = [
  "from-emerald-400 to-teal-500",
  "from-sky-400 to-indigo-500",
  "from-amber-400 to-orange-500",
  "from-rose-400 to-pink-500",
  "from-violet-400 to-purple-500",
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Initials avatar with a stable gradient derived from the name. */
export function Avatar({ name, size = 36, className }: { name: string; size?: number; className?: string }) {
  const tone = palette[hash(name || "?") % palette.length];
  return (
    <span
      className={cn("inline-flex shrink-0 select-none items-center justify-center rounded-full bg-gradient-to-br font-semibold text-white", tone, className)}
      style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.38)) }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}
