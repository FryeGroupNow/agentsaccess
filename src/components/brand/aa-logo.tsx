import * as React from 'react'

// ─────────────────────────────────────────────────────────────────────
// AgentsAccess brand mark — 10 concepts, round 3.
//
// Each concept is shown in two colorways:
//   - Indigo (#4f46e5)
//   - Orange (#f97316)
// Plus a special dual-color variant where applicable.
//
// All on #0f0f1a dark rounded-square, viewBox 0 0 32 32.
// ─────────────────────────────────────────────────────────────────────

interface Props extends React.SVGProps<SVGSVGElement> {
  className?: string
  color?: string
}

// ── 1. Stacked AA v2 ────────────────────────────────────────────────
// Two READABLE A letters stacked — the top A is smaller, the bottom A
// is larger. Each A has visible crossbars so they clearly read as
// letters, not triangles. The top A sits inside the peak of the bottom.
export function Logo1({ className = 'w-6 h-6', color = '#4f46e5', ...rest }: Props) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="AgentsAccess" role="img" {...rest}>
      <rect width="32" height="32" rx="7" fill="#0f0f1a" />
      {/* Bottom A — large */}
      <path d="M6 27 L16 8 L26 27" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <line x1="9.5" y1="21" x2="22.5" y2="21" stroke={color} strokeWidth="2" strokeLinecap="round" />
      {/* Top A — smaller, nested in the peak */}
      <path d="M12.5 18 L16 10.5 L19.5 18" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <line x1="13.8" y1="15.5" x2="18.2" y2="15.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

// ── 2. Stacked AA Dual Color ────────────────────────────────────────
// Same as #1 but top A is orange, bottom A is indigo. Two-tone mark.
export function Logo2({ className = 'w-6 h-6', ...rest }: Props) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="AgentsAccess" role="img" {...rest}>
      <rect width="32" height="32" rx="7" fill="#0f0f1a" />
      <path d="M6 27 L16 8 L26 27" stroke="#4f46e5" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <line x1="9.5" y1="21" x2="22.5" y2="21" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" />
      <path d="M12.5 18 L16 10.5 L19.5 18" stroke="#f97316" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <line x1="13.8" y1="15.5" x2="18.2" y2="15.5" stroke="#f97316" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

// ── 3. Side-by-Side AA ──────────────────────────────────────────────
// Two distinct A letters next to each other. Both have clear crossbars.
// Left A slightly overlaps right A at the base for a ligature feel.
export function Logo3({ className = 'w-6 h-6', color = '#4f46e5', ...rest }: Props) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="AgentsAccess" role="img" {...rest}>
      <rect width="32" height="32" rx="7" fill="#0f0f1a" />
      {/* Left A */}
      <path d="M4 26 L11 6 L18 26" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <line x1="6.8" y1="19" x2="15.2" y2="19" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      {/* Right A */}
      <path d="M14 26 L21 6 L28 26" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <line x1="16.8" y1="19" x2="25.2" y2="19" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

// ── 4. Side-by-Side Dual Color ──────────────────────────────────────
// Left A indigo, right A orange. Clear two-letter read.
export function Logo4({ className = 'w-6 h-6', ...rest }: Props) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="AgentsAccess" role="img" {...rest}>
      <rect width="32" height="32" rx="7" fill="#0f0f1a" />
      <path d="M4 26 L11 6 L18 26" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <line x1="6.8" y1="19" x2="15.2" y2="19" stroke="#4f46e5" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M14 26 L21 6 L28 26" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <line x1="16.8" y1="19" x2="25.2" y2="19" stroke="#f97316" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

// ── 5. Bold Filled A ────────────────────────────────────────────────
// Single thick A with a filled body and a cutout crossbar. Reads like
// a road sign A — unmistakable at any size. Solid and confident.
export function Logo5({ className = 'w-6 h-6', color = '#4f46e5', ...rest }: Props) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="AgentsAccess" role="img" {...rest}>
      <rect width="32" height="32" rx="7" fill="#0f0f1a" />
      {/* Filled A with triangular cutout */}
      <path
        d="M16 3 L4 28 L10 28 L12.5 21 L19.5 21 L22 28 L28 28 Z"
        fill={color}
      />
      {/* Cutout — dark triangle to form the A hole */}
      <path d="M16 10 L13 19 L19 19 Z" fill="#0f0f1a" />
    </svg>
  )
}

// ── 6. Agent Badge ──────────────────────────────────────────────────
// Shield with a bold A inside. Verified-agent mark. Clean lines.
export function Logo6({ className = 'w-6 h-6', color = '#4f46e5', ...rest }: Props) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="AgentsAccess" role="img" {...rest}>
      <rect width="32" height="32" rx="7" fill="#0f0f1a" />
      {/* Shield */}
      <path
        d="M16 3 L5 8 L5 17 Q5 26 16 29 Q27 26 27 17 L27 8 Z"
        stroke={color} strokeWidth="1.8" strokeLinejoin="round" fill="none"
      />
      {/* Bold A inside */}
      <path
        d="M16 8 L10 24 L13 24 L14.5 20 L17.5 20 L19 24 L22 24 Z"
        fill={color}
      />
      <path d="M16 13 L14.8 18 L17.2 18 Z" fill="#0f0f1a" />
    </svg>
  )
}

// ── 7. Circuit A ────────────────────────────────────────────────────
// Right-angle traces forming an A. Dots at corners. PCB aesthetic.
export function Logo7({ className = 'w-6 h-6', color = '#4f46e5', ...rest }: Props) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="AgentsAccess" role="img" {...rest}>
      <rect width="32" height="32" rx="7" fill="#0f0f1a" />
      <polyline points="8,27 8,10 16,5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <polyline points="16,5 24,10 24,27" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <line x1="8" y1="18" x2="24" y2="18" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="8" cy="27" r="1.6" fill={color} />
      <circle cx="8" cy="10" r="1.6" fill={color} />
      <circle cx="16" cy="5" r="1.8" fill={color} />
      <circle cx="24" cy="10" r="1.6" fill={color} />
      <circle cx="24" cy="27" r="1.6" fill={color} />
    </svg>
  )
}

// ── 8. Portal A ─────────────────────────────────────────────────────
// Two concentric A outlines forming a doorway. Dark fill between them
// creates depth. Crossbar is the threshold line.
export function Logo8({ className = 'w-6 h-6', color = '#4f46e5', ...rest }: Props) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="AgentsAccess" role="img" {...rest}>
      <rect width="32" height="32" rx="7" fill="#0f0f1a" />
      <path d="M16 3 L5 28 L27 28 Z" stroke={color} strokeWidth="2" strokeLinejoin="round" fill="none" />
      <path d="M16 10 L10 25 L22 25 Z" stroke={color} strokeWidth="1.2" strokeLinejoin="round" fill="#1e1b4b" />
      <line x1="8" y1="20" x2="24" y2="20" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

// ── 9. Bot Face ─────────────────────────────────────────────────────
// Rounded rect head with two dot eyes and a flat visor line. Antenna
// on top. Minimal, geometric, reads as "agent" at any size.
export function Logo9({ className = 'w-6 h-6', color = '#4f46e5', ...rest }: Props) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="AgentsAccess" role="img" {...rest}>
      <rect width="32" height="32" rx="7" fill="#0f0f1a" />
      {/* Antenna */}
      <line x1="16" y1="3" x2="16" y2="7" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="16" cy="3" r="1.3" fill={color} />
      {/* Head */}
      <rect x="7" y="8" width="18" height="16" rx="4" stroke={color} strokeWidth="2" fill="none" />
      {/* Eyes */}
      <circle cx="12.5" cy="15" r="2" fill={color} />
      <circle cx="19.5" cy="15" r="2" fill={color} />
      {/* Mouth */}
      <line x1="12" y1="20" x2="20" y2="20" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      {/* Ear nodes */}
      <circle cx="5" cy="16" r="1.5" fill={color} />
      <circle cx="27" cy="16" r="1.5" fill={color} />
    </svg>
  )
}

// ── 10. Monogram Ring ───────────────────────────────────────────────
// "AA" centered inside a thin circle. Clean, corporate, reads at
// every size. The letters are compact and bold.
export function Logo10({ className = 'w-6 h-6', color = '#4f46e5', ...rest }: Props) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="AgentsAccess" role="img" {...rest}>
      <rect width="32" height="32" rx="7" fill="#0f0f1a" />
      {/* Ring */}
      <circle cx="16" cy="16" r="12.5" stroke={color} strokeWidth="1.5" fill="none" />
      {/* Left A */}
      <path d="M7 24 L12 9 L17 24" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <line x1="9" y1="19" x2="15" y2="19" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      {/* Right A */}
      <path d="M15 24 L20 9 L25 24" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <line x1="17" y1="19" x2="23" y2="19" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

// ── Active export ───────────────────────────────────────────────────
// Aliased to Logo1 by default. Change after picking.
export const AALogo = Logo1
export const AALogoMark = Logo1
