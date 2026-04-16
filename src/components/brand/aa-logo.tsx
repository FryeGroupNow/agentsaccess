import * as React from 'react'

// ─────────────────────────────────────────────────────────────────────
// AgentsAccess brand mark — round 5: 11 distinct A letterform styles.
//
// Each logo draws the letter A in a different "cyber font" — the
// typography IS the logo. All sharp edges (square/miter). #8, #8b,
// #9 kept from previous rounds.
// ─────────────────────────────────────────────────────────────────────

interface Props extends React.SVGProps<SVGSVGElement> {
  className?: string
  color?: string
}

const S = 'square' as const
const M = 'miter' as const
const BG = '#0f0f1a'

// ── 1. Thin Geometric ───────────────────────────────────────────────
// Perfect thin-stroke A. Uniform weight, precise angles. Minimal.
export function Logo1({ className = 'w-6 h-6', color = '#4f46e5', ...rest }: Props) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="AgentsAccess" role="img" {...rest}>
      <rect width="32" height="32" rx="7" fill={BG} />
      <path d="M6 27 L16 4 L26 27" stroke={color} strokeWidth="1.5" strokeLinecap={S} strokeLinejoin={M} />
      <line x1="9.5" y1="20" x2="22.5" y2="20" stroke={color} strokeWidth="1.5" strokeLinecap={S} />
    </svg>
  )
}

// ── 2. Heavy Slab ───────────────────────────────────────────────────
// Ultra-thick strokes with flat rectangular serifs at the feet.
// Brutalist / industrial type.
export function Logo2({ className = 'w-6 h-6', color = '#4f46e5', ...rest }: Props) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="AgentsAccess" role="img" {...rest}>
      <rect width="32" height="32" rx="7" fill={BG} />
      <path d="M16 4 L5 25 L27 25 Z" fill={color} />
      <path d="M16 11 L11.5 23 L20.5 23 Z" fill={BG} />
      {/* Slab serifs at feet */}
      <rect x="3" y="25" width="8" height="3" fill={color} />
      <rect x="21" y="25" width="8" height="3" fill={color} />
    </svg>
  )
}

// ── 3. Stencil ──────────────────────────────────────────────────────
// A with visible gaps/breaks in the strokes where stencil bridges
// would be. Military / industrial. Reads as A through the gaps.
export function Logo3({ className = 'w-6 h-6', color = '#4f46e5', ...rest }: Props) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="AgentsAccess" role="img" {...rest}>
      <rect width="32" height="32" rx="7" fill={BG} />
      {/* Left leg — broken in middle */}
      <line x1="6" y1="27" x2="10" y2="16" stroke={color} strokeWidth="2.5" strokeLinecap={S} />
      <line x1="11.5" y1="12" x2="15" y2="4" stroke={color} strokeWidth="2.5" strokeLinecap={S} />
      {/* Right leg — broken in middle */}
      <line x1="17" y1="4" x2="20.5" y2="12" stroke={color} strokeWidth="2.5" strokeLinecap={S} />
      <line x1="22" y1="16" x2="26" y2="27" stroke={color} strokeWidth="2.5" strokeLinecap={S} />
      {/* Crossbar — broken center */}
      <line x1="9" y1="19" x2="13" y2="19" stroke={color} strokeWidth="2.5" strokeLinecap={S} />
      <line x1="19" y1="19" x2="23" y2="19" stroke={color} strokeWidth="2.5" strokeLinecap={S} />
    </svg>
  )
}

// ── 4. Pixel ────────────────────────────────────────────────────────
// A built from small square blocks on a 5-column grid. 8-bit retro.
export function Logo4({ className = 'w-6 h-6', color = '#4f46e5', ...rest }: Props) {
  const b = 4.5 // block size
  const g = 0.6 // gap
  const cell = (col: number, row: number) => (
    <rect key={`${col}-${row}`} x={5 + col * (b + g)} y={3 + row * (b + g)} width={b} height={b} fill={color} />
  )
  // A shape on a 5x5 grid:
  // row 0:   . . X . .
  // row 1:   . X . X .
  // row 2:   X . . . X
  // row 3:   X X X X X
  // row 4:   X . . . X
  const cells: [number, number][] = [
    [2,0],
    [1,1],[3,1],
    [0,2],[4,2],
    [0,3],[1,3],[2,3],[3,3],[4,3],
    [0,4],[4,4],
  ]
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="AgentsAccess" role="img" {...rest}>
      <rect width="32" height="32" rx="7" fill={BG} />
      {cells.map(([c, r]) => cell(c, r))}
    </svg>
  )
}

// ── 5. Blade ────────────────────────────────────────────────────────
// Ultra-angular sci-fi A. Tapered strokes — thick at base, thin at
// apex. Crossbar is angled. Blade Runner / cyberpunk aesthetic.
export function Logo5({ className = 'w-6 h-6', color = '#4f46e5', ...rest }: Props) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="AgentsAccess" role="img" {...rest}>
      <rect width="32" height="32" rx="7" fill={BG} />
      {/* Filled tapered A — wide at bottom, sharp at top */}
      <path d="M16 3 L14.5 3 L3 28 L9 28 L12 20 L22 18 L25 28 L29 28 L17.5 3 Z" fill={color} />
      {/* Cutout */}
      <path d="M15.5 9 L11.5 18 L20.5 16.5 Z" fill={BG} />
    </svg>
  )
}

// ── 6. Angular Gothic ───────────────────────────────────────────────
// A with blackletter-inspired angular strokes and thick-thin contrast.
// The verticals are thick, diagonals thin, crossbar ornamental.
export function Logo6({ className = 'w-6 h-6', color = '#4f46e5', ...rest }: Props) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="AgentsAccess" role="img" {...rest}>
      <rect width="32" height="32" rx="7" fill={BG} />
      {/* Left thick vertical segment */}
      <line x1="8" y1="27" x2="8" y2="10" stroke={color} strokeWidth="3.5" strokeLinecap={S} />
      {/* Thin diagonal to apex */}
      <line x1="8" y1="10" x2="16" y2="4" stroke={color} strokeWidth="1.2" strokeLinecap={S} />
      {/* Thin diagonal from apex */}
      <line x1="16" y1="4" x2="24" y2="10" stroke={color} strokeWidth="1.2" strokeLinecap={S} />
      {/* Right thick vertical */}
      <line x1="24" y1="10" x2="24" y2="27" stroke={color} strokeWidth="3.5" strokeLinecap={S} />
      {/* Ornamental crossbar — double line */}
      <line x1="8" y1="18" x2="24" y2="18" stroke={color} strokeWidth="2" strokeLinecap={S} />
      <line x1="8" y1="21" x2="24" y2="21" stroke={color} strokeWidth="0.8" strokeLinecap={S} />
    </svg>
  )
}

// ── 7. Tech Block ───────────────────────────────────────────────────
// Wide, heavy A made of thick rectangular segments. Digital display
// / seven-segment inspired but with an A shape.
export function Logo7({ className = 'w-6 h-6', color = '#4f46e5', ...rest }: Props) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="AgentsAccess" role="img" {...rest}>
      <rect width="32" height="32" rx="7" fill={BG} />
      {/* Top segment */}
      <rect x="10" y="4" width="12" height="3" fill={color} />
      {/* Left upper vertical */}
      <rect x="7" y="4" width="3" height="12" fill={color} />
      {/* Right upper vertical */}
      <rect x="22" y="4" width="3" height="12" fill={color} />
      {/* Middle crossbar */}
      <rect x="7" y="15" width="18" height="3" fill={color} />
      {/* Left lower vertical */}
      <rect x="7" y="18" width="3" height="10" fill={color} />
      {/* Right lower vertical */}
      <rect x="22" y="18" width="3" height="10" fill={color} />
    </svg>
  )
}

// ── 8. Portal A ─────────────────────────────────────────────────────
// KEPT — two concentric open A's with crossbar.
export function Logo8({ className = 'w-6 h-6', color = '#4f46e5', ...rest }: Props) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="AgentsAccess" role="img" {...rest}>
      <rect width="32" height="32" rx="7" fill={BG} />
      <line x1="5" y1="28" x2="16" y2="3" stroke={color} strokeWidth="2" strokeLinecap={S} />
      <line x1="16" y1="3" x2="27" y2="28" stroke={color} strokeWidth="2" strokeLinecap={S} />
      <line x1="10" y1="25" x2="16" y2="10" stroke={color} strokeWidth="1.3" strokeLinecap={S} />
      <line x1="16" y1="10" x2="22" y2="25" stroke={color} strokeWidth="1.3" strokeLinecap={S} />
      <line x1="9" y1="20" x2="23" y2="20" stroke={color} strokeWidth="2" strokeLinecap={S} />
    </svg>
  )
}

// ── 8b. Portal A (dual color) ───────────────────────────────────────
export function Logo8Dual({ className = 'w-6 h-6', ...rest }: Props) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="AgentsAccess" role="img" {...rest}>
      <rect width="32" height="32" rx="7" fill={BG} />
      <line x1="5" y1="28" x2="16" y2="3" stroke="#4f46e5" strokeWidth="2" strokeLinecap={S} />
      <line x1="16" y1="3" x2="27" y2="28" stroke="#4f46e5" strokeWidth="2" strokeLinecap={S} />
      <line x1="10" y1="25" x2="16" y2="10" stroke="#f97316" strokeWidth="1.4" strokeLinecap={S} />
      <line x1="16" y1="10" x2="22" y2="25" stroke="#f97316" strokeWidth="1.4" strokeLinecap={S} />
      <line x1="9" y1="20" x2="23" y2="20" stroke="#4f46e5" strokeWidth="2" strokeLinecap={S} />
    </svg>
  )
}

// ── 9. Bot Face ─────────────────────────────────────────────────────
// KEPT.
export function Logo9({ className = 'w-6 h-6', color = '#4f46e5', ...rest }: Props) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="AgentsAccess" role="img" {...rest}>
      <rect width="32" height="32" rx="7" fill={BG} />
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

// ── 10. Wireframe ───────────────────────────────────────────────────
// A drawn with thin lines and visible vertex dots, like a 3D
// wireframe render. Technical / engineering blueprint feel.
export function Logo10({ className = 'w-6 h-6', color = '#4f46e5', ...rest }: Props) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="AgentsAccess" role="img" {...rest}>
      <rect width="32" height="32" rx="7" fill={BG} />
      <path d="M6 27 L16 4 L26 27" stroke={color} strokeWidth="1" strokeLinecap={S} strokeLinejoin={M} />
      <line x1="9.5" y1="20" x2="22.5" y2="20" stroke={color} strokeWidth="1" strokeLinecap={S} />
      {/* Vertex dots */}
      <rect x="14.5" y="2.5" width="3" height="3" fill={color} />
      <rect x="4.5" y="25.5" width="3" height="3" fill={color} />
      <rect x="24.5" y="25.5" width="3" height="3" fill={color} />
      <rect x="8" y="18.5" width="3" height="3" fill={color} />
      <rect x="21" y="18.5" width="3" height="3" fill={color} />
    </svg>
  )
}

// ── 11. Apex (custom original) ──────────────────────────────────────
// My own design: A with an extended spike above the apex (like an
// antenna/sword), asymmetric crossbar offset slightly left, and a
// small notch cut from the bottom of the left foot. Unique silhouette
// that doesn't look like any standard typeface.
export function Logo11({ className = 'w-6 h-6', color = '#4f46e5', ...rest }: Props) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="AgentsAccess" role="img" {...rest}>
      <rect width="32" height="32" rx="7" fill={BG} />
      {/* Extended apex spike */}
      <line x1="16" y1="2" x2="16" y2="7" stroke={color} strokeWidth="1.5" strokeLinecap={S} />
      {/* Main A body */}
      <path d="M6 28 L16 7 L26 28" stroke={color} strokeWidth="2.4" strokeLinecap={S} strokeLinejoin={M} fill="none" />
      {/* Asymmetric crossbar — offset left */}
      <line x1="8" y1="21" x2="19" y2="19" stroke={color} strokeWidth="2" strokeLinecap={S} />
      {/* Left foot notch */}
      <line x1="6" y1="28" x2="9" y2="24" stroke={BG} strokeWidth="2.5" strokeLinecap={S} />
      <line x1="6" y1="28" x2="9" y2="24" stroke={color} strokeWidth="0.8" strokeLinecap={S} />
    </svg>
  )
}

// ── Active export ───────────────────────────────────────────────────
export const AALogo = Logo1
export const AALogoMark = Logo1
