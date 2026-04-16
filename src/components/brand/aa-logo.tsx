import * as React from 'react'

// ─────────────────────────────────────────────────────────────────────
// AgentsAccess brand mark — round 4.
//
// ALL strokes use square/miter caps for sharp, clean edges.
// No rounded lines anywhere.
//
// #8, #8b, #9, #10 kept from previous rounds per user request.
// Everything else is new.
// ─────────────────────────────────────────────────────────────────────

interface Props extends React.SVGProps<SVGSVGElement> {
  className?: string
  color?: string
}

const S = 'square' as const   // strokeLinecap
const M = 'miter' as const    // strokeLinejoin

// ── 1. Split A ──────────────────────────────────────────────────────
// Single A with a thin vertical gap down the center that makes it
// read as two A's. One letterform, double impression.
export function Logo1({ className = 'w-6 h-6', color = '#4f46e5', ...rest }: Props) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="AgentsAccess" role="img" {...rest}>
      <rect width="32" height="32" rx="7" fill="#0f0f1a" />
      {/* Left half of A */}
      <path d="M5 28 L15 3 L15 28" stroke={color} strokeWidth="2.2" strokeLinecap={S} strokeLinejoin={M} />
      <line x1="8.5" y1="19" x2="15" y2="19" stroke={color} strokeWidth="2" strokeLinecap={S} />
      {/* Right half of A — separated by 2px gap */}
      <path d="M17 28 L17 3 L27 28" stroke={color} strokeWidth="2.2" strokeLinecap={S} strokeLinejoin={M} />
      <line x1="17" y1="19" x2="23.5" y2="19" stroke={color} strokeWidth="2" strokeLinecap={S} />
    </svg>
  )
}

// ── 2. Shadow A ─────────────────────────────────────────────────────
// Single A with an offset echo/shadow behind it. Creates a doubled
// impression without being two separate letters.
export function Logo2({ className = 'w-6 h-6', color = '#4f46e5', ...rest }: Props) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="AgentsAccess" role="img" {...rest}>
      <rect width="32" height="32" rx="7" fill="#0f0f1a" />
      {/* Shadow A — offset right+down, lighter */}
      <path d="M9 28 L18 4 L27 28" stroke={color} strokeWidth="2" strokeLinecap={S} strokeLinejoin={M} opacity="0.3" />
      <line x1="12.5" y1="19" x2="23.5" y2="19" stroke={color} strokeWidth="1.8" strokeLinecap={S} opacity="0.3" />
      {/* Main A */}
      <path d="M5 28 L14 4 L23 28" stroke={color} strokeWidth="2.2" strokeLinecap={S} strokeLinejoin={M} />
      <line x1="8.5" y1="19" x2="19.5" y2="19" stroke={color} strokeWidth="2" strokeLinecap={S} />
    </svg>
  )
}

// ── 3. Notch A ──────────────────────────────────────────────────────
// Single A with a V-notch cut into the apex, splitting it into twin
// peaks. One letter that reads as AA from the silhouette.
export function Logo3({ className = 'w-6 h-6', color = '#4f46e5', ...rest }: Props) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="AgentsAccess" role="img" {...rest}>
      <rect width="32" height="32" rx="7" fill="#0f0f1a" />
      {/* A body with notched apex — two peaks */}
      <path
        d="M5 28 L12 5 L16 12 L20 5 L27 28"
        stroke={color} strokeWidth="2.2" strokeLinecap={S} strokeLinejoin={M} fill="none"
      />
      {/* Crossbar */}
      <line x1="8.5" y1="19" x2="23.5" y2="19" stroke={color} strokeWidth="2" strokeLinecap={S} />
    </svg>
  )
}

// ── 4. Double-Bar A ─────────────────────────────────────────────────
// Single A with two crossbars stacked close together. The twin bars
// suggest "AA" — two levels, two letters implied.
export function Logo4({ className = 'w-6 h-6', color = '#4f46e5', ...rest }: Props) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="AgentsAccess" role="img" {...rest}>
      <rect width="32" height="32" rx="7" fill="#0f0f1a" />
      <path d="M5 28 L16 4 L27 28" stroke={color} strokeWidth="2.2" strokeLinecap={S} strokeLinejoin={M} fill="none" />
      {/* Upper crossbar */}
      <line x1="9.5" y1="17" x2="22.5" y2="17" stroke={color} strokeWidth="1.8" strokeLinecap={S} />
      {/* Lower crossbar */}
      <line x1="11" y1="21" x2="21" y2="21" stroke={color} strokeWidth="1.8" strokeLinecap={S} />
    </svg>
  )
}

// ── 5. Filled Split A ───────────────────────────────────────────────
// Bold filled A with a dark vertical line splitting it down the center.
// Reads as a solid mark from afar, as "AA" up close.
export function Logo5({ className = 'w-6 h-6', color = '#4f46e5', ...rest }: Props) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="AgentsAccess" role="img" {...rest}>
      <rect width="32" height="32" rx="7" fill="#0f0f1a" />
      <path d="M16 3 L4 28 L10 28 L12.5 21 L19.5 21 L22 28 L28 28 Z" fill={color} />
      <path d="M16 10 L13 19 L19 19 Z" fill="#0f0f1a" />
      {/* Vertical split — dark line bisecting the A */}
      <line x1="16" y1="3" x2="16" y2="28" stroke="#0f0f1a" strokeWidth="1.5" strokeLinecap={S} />
    </svg>
  )
}

// ── 6. Stencil A ────────────────────────────────────────────────────
// Thick filled A made of two separate halves with a gap between them
// and a rectangular crossbar cutout. Industrial/stencil aesthetic.
export function Logo6({ className = 'w-6 h-6', color = '#4f46e5', ...rest }: Props) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="AgentsAccess" role="img" {...rest}>
      <rect width="32" height="32" rx="7" fill="#0f0f1a" />
      {/* Left half */}
      <path d="M15.2 3 L4 28 L10 28 L12.5 21 L15.2 21 L15.2 19 L8.5 19 L15.2 3 Z" fill={color} />
      {/* Right half */}
      <path d="M16.8 3 L28 28 L22 28 L19.5 21 L16.8 21 L16.8 19 L23.5 19 L16.8 3 Z" fill={color} />
    </svg>
  )
}

// ── 7. Slash A ──────────────────────────────────────────────────────
// Single A with a forward-slash cutting diagonally across it. The
// slash creates a visual break that implies two overlapping forms.
export function Logo7({ className = 'w-6 h-6', color = '#4f46e5', ...rest }: Props) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="AgentsAccess" role="img" {...rest}>
      <rect width="32" height="32" rx="7" fill="#0f0f1a" />
      <path d="M5 28 L16 4 L27 28" stroke={color} strokeWidth="2.2" strokeLinecap={S} strokeLinejoin={M} fill="none" />
      <line x1="8.5" y1="19" x2="23.5" y2="19" stroke={color} strokeWidth="2" strokeLinecap={S} />
      {/* Diagonal slash */}
      <line x1="22" y1="5" x2="10" y2="27" stroke="#0f0f1a" strokeWidth="2.5" strokeLinecap={S} />
      <line x1="22" y1="5" x2="10" y2="27" stroke={color} strokeWidth="0.8" strokeLinecap={S} opacity="0.5" />
    </svg>
  )
}

// ── 8. Portal A ─────────────────────────────────────────────────────
// KEPT — two concentric open A's, crossbar trimmed to outer legs.
export function Logo8({ className = 'w-6 h-6', color = '#4f46e5', ...rest }: Props) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="AgentsAccess" role="img" {...rest}>
      <rect width="32" height="32" rx="7" fill="#0f0f1a" />
      <line x1="5" y1="28" x2="16" y2="3" stroke={color} strokeWidth="2" strokeLinecap={S} />
      <line x1="16" y1="3" x2="27" y2="28" stroke={color} strokeWidth="2" strokeLinecap={S} />
      <line x1="10" y1="25" x2="16" y2="10" stroke={color} strokeWidth="1.3" strokeLinecap={S} />
      <line x1="16" y1="10" x2="22" y2="25" stroke={color} strokeWidth="1.3" strokeLinecap={S} />
      <line x1="9" y1="20" x2="23" y2="20" stroke={color} strokeWidth="2" strokeLinecap={S} />
    </svg>
  )
}

// ── 8b. Portal A (dual color) ───────────────────────────────────────
// KEPT — outer A indigo, inner A orange.
export function Logo8Dual({ className = 'w-6 h-6', ...rest }: Props) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="AgentsAccess" role="img" {...rest}>
      <rect width="32" height="32" rx="7" fill="#0f0f1a" />
      <line x1="5" y1="28" x2="16" y2="3" stroke="#4f46e5" strokeWidth="2" strokeLinecap={S} />
      <line x1="16" y1="3" x2="27" y2="28" stroke="#4f46e5" strokeWidth="2" strokeLinecap={S} />
      <line x1="10" y1="25" x2="16" y2="10" stroke="#f97316" strokeWidth="1.4" strokeLinecap={S} />
      <line x1="16" y1="10" x2="22" y2="25" stroke="#f97316" strokeWidth="1.4" strokeLinecap={S} />
      <line x1="9" y1="20" x2="23" y2="20" stroke="#4f46e5" strokeWidth="2" strokeLinecap={S} />
    </svg>
  )
}

// ── 9. Bot Face ─────────────────────────────────────────────────────
// KEPT — rounded head, eyes, visor, antenna, ear nodes.
export function Logo9({ className = 'w-6 h-6', color = '#4f46e5', ...rest }: Props) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="AgentsAccess" role="img" {...rest}>
      <rect width="32" height="32" rx="7" fill="#0f0f1a" />
      <line x1="16" y1="3" x2="16" y2="7" stroke={color} strokeWidth="1.5" strokeLinecap={S} />
      <circle cx="16" cy="3" r="1.3" fill={color} />
      <rect x="7" y="8" width="18" height="16" rx="4" stroke={color} strokeWidth="2" fill="none" />
      <circle cx="12.5" cy="15" r="2" fill={color} />
      <circle cx="19.5" cy="15" r="2" fill={color} />
      <line x1="12" y1="20" x2="20" y2="20" stroke={color} strokeWidth="1.5" strokeLinecap={S} />
      <circle cx="5" cy="16" r="1.5" fill={color} />
      <circle cx="27" cy="16" r="1.5" fill={color} />
    </svg>
  )
}

// ── 10. Monogram Ring ───────────────────────────────────────────────
// KEPT — "AA" inside a thin circle. Sharp strokes.
export function Logo10({ className = 'w-6 h-6', color = '#4f46e5', ...rest }: Props) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="AgentsAccess" role="img" {...rest}>
      <rect width="32" height="32" rx="7" fill="#0f0f1a" />
      <circle cx="16" cy="16" r="12.5" stroke={color} strokeWidth="1.5" fill="none" />
      <path d="M7 24 L12 9 L17 24" stroke={color} strokeWidth="2" strokeLinecap={S} strokeLinejoin={M} fill="none" />
      <line x1="9" y1="19" x2="15" y2="19" stroke={color} strokeWidth="1.5" strokeLinecap={S} />
      <path d="M15 24 L20 9 L25 24" stroke={color} strokeWidth="2" strokeLinecap={S} strokeLinejoin={M} fill="none" />
      <line x1="17" y1="19" x2="23" y2="19" stroke={color} strokeWidth="1.5" strokeLinecap={S} />
    </svg>
  )
}

// ── 11. Notch A Dual ────────────────────────────────────────────────
// Same notch concept as #3 but left peak indigo, right peak orange.
export function Logo11({ className = 'w-6 h-6', ...rest }: Props) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="AgentsAccess" role="img" {...rest}>
      <rect width="32" height="32" rx="7" fill="#0f0f1a" />
      <path d="M5 28 L12 5 L16 12" stroke="#4f46e5" strokeWidth="2.2" strokeLinecap={S} strokeLinejoin={M} fill="none" />
      <path d="M16 12 L20 5 L27 28" stroke="#f97316" strokeWidth="2.2" strokeLinecap={S} strokeLinejoin={M} fill="none" />
      <line x1="8.5" y1="19" x2="16" y2="19" stroke="#4f46e5" strokeWidth="2" strokeLinecap={S} />
      <line x1="16" y1="19" x2="23.5" y2="19" stroke="#f97316" strokeWidth="2" strokeLinecap={S} />
    </svg>
  )
}

// ── Active export ───────────────────────────────────────────────────
export const AALogo = Logo3
export const AALogoMark = Logo3
