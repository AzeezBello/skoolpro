import { cn } from "@/lib/utils";

/**
 * Flat illustration of a school campus: building, sun, trees and a path.
 * Uses currentColor for line work so it adapts to the surrounding text
 * colour, with brand accents fixed to the palette.
 */
export function SchoolIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 520 340" className={cn("h-auto w-full", className)} role="img" aria-label="Illustration of a school campus">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0ea5e9" stopOpacity="0.25" />
          <stop offset="1" stopColor="#0ea5e9" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="roof" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#34d399" />
          <stop offset="1" stopColor="#059669" />
        </linearGradient>
        <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="1" stopColor="#e2e8f0" />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width="520" height="340" rx="28" fill="url(#sky)" />

      {/* sun */}
      <circle cx="430" cy="70" r="30" fill="#fbbf24" opacity="0.9" />
      <circle cx="430" cy="70" r="44" fill="#fbbf24" opacity="0.15" />

      {/* clouds */}
      <g fill="#ffffff" opacity="0.85">
        <ellipse cx="110" cy="70" rx="34" ry="14" />
        <ellipse cx="135" cy="62" rx="26" ry="16" />
        <ellipse cx="86" cy="64" rx="20" ry="12" />
        <ellipse cx="330" cy="110" rx="28" ry="11" />
        <ellipse cx="350" cy="104" rx="20" ry="13" />
      </g>

      {/* ground */}
      <ellipse cx="260" cy="300" rx="250" ry="34" fill="#10b981" opacity="0.18" />
      <ellipse cx="260" cy="296" rx="210" ry="26" fill="#10b981" opacity="0.28" />

      {/* main building */}
      <rect x="140" y="150" width="240" height="120" rx="8" fill="url(#wall)" />
      <polygon points="130,152 260,96 390,152" fill="url(#roof)" />
      <rect x="236" y="120" width="48" height="36" rx="4" fill="#ffffff" />
      <polygon points="230,122 260,106 290,122" fill="#059669" />
      <rect x="252" y="136" width="16" height="20" rx="2" fill="#0ea5e9" opacity="0.8" />

      {/* clock */}
      <circle cx="260" cy="172" r="14" fill="#ffffff" stroke="#0f172a" strokeOpacity="0.2" strokeWidth="2" />
      <path d="M260 164 V172 L266 176" stroke="#0f172a" strokeOpacity="0.6" strokeWidth="2" strokeLinecap="round" fill="none" />

      {/* windows */}
      <g fill="#0ea5e9" opacity="0.75">
        <rect x="160" y="170" width="26" height="26" rx="4" />
        <rect x="198" y="170" width="26" height="26" rx="4" />
        <rect x="296" y="170" width="26" height="26" rx="4" />
        <rect x="334" y="170" width="26" height="26" rx="4" />
        <rect x="160" y="212" width="26" height="26" rx="4" />
        <rect x="198" y="212" width="26" height="26" rx="4" />
        <rect x="296" y="212" width="26" height="26" rx="4" />
        <rect x="334" y="212" width="26" height="26" rx="4" />
      </g>
      <g stroke="#ffffff" strokeWidth="2" opacity="0.9">
        <path d="M173 170 V196 M160 183 H186" />
        <path d="M211 170 V196 M198 183 H224" />
        <path d="M309 170 V196 M296 183 H322" />
        <path d="M347 170 V196 M334 183 H360" />
        <path d="M173 212 V238 M160 225 H186" />
        <path d="M211 212 V238 M198 225 H224" />
        <path d="M309 212 V238 M296 225 H322" />
        <path d="M347 212 V238 M334 225 H360" />
      </g>

      {/* door */}
      <rect x="242" y="212" width="36" height="58" rx="6" fill="#059669" />
      <rect x="248" y="220" width="24" height="26" rx="3" fill="#ffffff" opacity="0.7" />
      <circle cx="270" cy="248" r="2.5" fill="#fbbf24" />

      {/* steps + path */}
      <rect x="226" y="268" width="68" height="6" rx="3" fill="#cbd5e1" />
      <rect x="218" y="274" width="84" height="6" rx="3" fill="#94a3b8" />
      <path d="M260 280 C 240 300, 230 310, 200 330" stroke="#e2e8f0" strokeWidth="14" strokeLinecap="round" fill="none" opacity="0.8" />

      {/* flag */}
      <path d="M400 150 V270" stroke="#64748b" strokeWidth="3" strokeLinecap="round" />
      <path d="M401 152 L440 162 L401 172 Z" fill="#10b981" />

      {/* trees */}
      <g>
        <rect x="76" y="234" width="8" height="36" rx="3" fill="#92400e" opacity="0.7" />
        <circle cx="80" cy="222" r="30" fill="#10b981" />
        <circle cx="66" cy="236" r="18" fill="#34d399" />
        <circle cx="96" cy="236" r="18" fill="#059669" />
      </g>
      <g>
        <rect x="458" y="240" width="8" height="30" rx="3" fill="#92400e" opacity="0.7" />
        <circle cx="462" cy="230" r="24" fill="#10b981" />
        <circle cx="450" cy="242" r="14" fill="#34d399" />
        <circle cx="476" cy="242" r="14" fill="#059669" />
      </g>

      {/* students */}
      <g>
        <circle cx="178" cy="286" r="9" fill="#fcd9b6" />
        <rect x="170" y="296" width="16" height="22" rx="6" fill="#0ea5e9" />
        <circle cx="206" cy="290" r="8" fill="#8d5524" />
        <rect x="199" y="299" width="14" height="20" rx="6" fill="#10b981" />
        <circle cx="330" cy="288" r="9" fill="#8d5524" />
        <rect x="322" y="298" width="16" height="22" rx="6" fill="#f59e0b" />
      </g>
    </svg>
  );
}
