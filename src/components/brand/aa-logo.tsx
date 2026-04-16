import * as React from 'react'

// ─────────────────────────────────────────────────────────────────────
// AgentsAccess brand mark — round 6b.
//
// Base letterform: Porta-style A by Alejo Bergmann — bold geometric
// display font, thick uniform strokes, flat/truncated apex, clean
// sharp cuts, architectural feel. No serifs, no curves.
//
// The flat top and wide blocky legs are what make Porta distinctive
// vs a generic triangle-A.
// ─────────────────────────────────────────────────────────────────────

interface Props extends React.SVGProps<SVGSVGElement> {
  className?: string
  color?: string
}

const BG = '#0f0f1a'
const M = 'miter' as const

// Porta-style A paths — flat truncated apex, thick blocky legs,
// geometric triangular counter, clean horizontal crossbar gap.
const OUTER = 'M12 3 L20 3 L30 29 L23 29 L20 20 L12 20 L9 29 L2 29 Z'
const COUNTER = 'M16 9 L13.5 18 L18.5 18 Z'

// ── 1. Shadow A ─────────────────────────────────────────────────────
// Solid Porta A with a ghosted duplicate offset behind it. The shadow
// peeks out right and down, hinting at a second A underneath.
export function Logo1({ className = 'w-6 h-6', color = '#4f46e5', ...rest }: Props) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="AgentsAccess" role="img" {...rest}>
      <rect width="32" height="32" rx="7" fill={BG} />
      {/* Ghost A — offset right+down */}
      <g transform="translate(2.5, 1)" opacity="0.3">
        <path d={OUTER} fill={color} />
        <path d={COUNTER} fill={BG} />
      </g>
      {/* Solid A */}
      <path d={OUTER} fill={color} />
      <path d={COUNTER} fill={BG} />
    </svg>
  )
}

// ── 2. Split A ──────────────────────────────────────────────────────
// One Porta A bisected down the center — left half dark indigo, right
// half lighter indigo. The tonal shift implies two A's merged.
export function Logo2({ className = 'w-6 h-6', color = '#4f46e5', ...rest }: Props) {
  const dark = color === '#4f46e5' ? '#4f46e5' : color
  const light = color === '#4f46e5' ? '#818cf8' : color
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="AgentsAccess" role="img" {...rest}>
      <rect width="32" height="32" rx="7" fill={BG} />
      <defs>
        <clipPath id="sl"><rect x="0" y="0" width="16" height="32" /></clipPath>
        <clipPath id="sr"><rect x="16" y="0" width="16" height="32" /></clipPath>
      </defs>
      <g clipPath="url(#sl)">
        <path d={OUTER} fill={dark} />
        <path d={COUNTER} fill={BG} />
      </g>
      <g clipPath="url(#sr)">
        <path d={OUTER} fill={light} />
        <path d={COUNTER} fill={BG} />
      </g>
    </svg>
  )
}

// ── 3. Layered A ────────────────────────────────────────────────────
// Bold filled Porta A in front, thin outline Porta A peeking out
// from behind it (offset top-left). Double-exposure layering.
export function Logo3({ className = 'w-6 h-6', color = '#4f46e5', ...rest }: Props) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="AgentsAccess" role="img" {...rest}>
      <rect width="32" height="32" rx="7" fill={BG} />
      {/* Outline A — offset top-left */}
      <g transform="translate(-2, -1)">
        <path d={OUTER} stroke={color} strokeWidth="1" strokeLinejoin={M} fill="none" opacity="0.4" />
        <path d={COUNTER} stroke={color} strokeWidth="0.7" strokeLinejoin={M} fill="none" opacity="0.4" />
      </g>
      {/* Solid A */}
      <path d={OUTER} fill={color} />
      <path d={COUNTER} fill={BG} />
    </svg>
  )
}

// ── Active export ───────────────────────────────────────────────────
export const AALogo = Logo1
export const AALogoMark = Logo1
