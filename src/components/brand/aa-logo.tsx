import * as React from 'react'

// ─────────────────────────────────────────────────────────────────────
// AgentsAccess brand mark — round 6.
//
// All three concepts use a Potra-style A: wide, bold, triangular,
// geometric, sharp cuts, no serifs. The A has thick uniform strokes,
// a flat horizontal crossbar, and an open bottom (no base).
//
// The "AA" is communicated through design tricks on a SINGLE letter,
// not two separate A's.
// ─────────────────────────────────────────────────────────────────────

interface Props extends React.SVGProps<SVGSVGElement> {
  className?: string
  color?: string
}

const BG = '#0f0f1a'
const M = 'miter' as const

// Base Potra-style A path constants (wide, bold, geometric).
// Outer shape + inner triangular cutout + crossbar gap.
const OUTER = 'M16 2 L2 29 L9.5 29 L12.5 22 L19.5 22 L22.5 29 L30 29 Z'
const INNER = 'M16 9 L13 20 L19 20 Z'

// ── 1. Shadow A ─────────────────────────────────────────────────────
// One solid Potra A with a slightly offset ghost A behind it in a
// lighter shade. Single letter, but the shadow creates a doubling.
export function Logo1({ className = 'w-6 h-6', color = '#4f46e5', ...rest }: Props) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="AgentsAccess" role="img" {...rest}>
      <rect width="32" height="32" rx="7" fill={BG} />
      {/* Shadow A — offset +2,+1, lighter shade */}
      <g opacity="0.35" transform="translate(2, 1)">
        <path d={OUTER} fill={color} />
        <path d={INNER} fill={BG} />
      </g>
      {/* Main A — solid */}
      <path d={OUTER} fill={color} />
      <path d={INNER} fill={BG} />
    </svg>
  )
}

// ── 2. Split A ──────────────────────────────────────────────────────
// One Potra A where the left half is a darker indigo and the right
// half is a lighter shade. The tonal split down the center axis
// suggests two A's fused into one.
export function Logo2({ className = 'w-6 h-6', color = '#4f46e5', ...rest }: Props) {
  // Derive a lighter shade: if custom color, just use opacity trick.
  // For the default indigo, #818cf8 is the natural lighter partner.
  const light = color === '#4f46e5' ? '#818cf8' : color
  const dark = color === '#4f46e5' ? '#4f46e5' : color
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="AgentsAccess" role="img" {...rest}>
      <rect width="32" height="32" rx="7" fill={BG} />
      <defs>
        <clipPath id="split-left">
          <rect x="0" y="0" width="16" height="32" />
        </clipPath>
        <clipPath id="split-right">
          <rect x="16" y="0" width="16" height="32" />
        </clipPath>
      </defs>
      {/* Left half — darker */}
      <g clipPath="url(#split-left)">
        <path d={OUTER} fill={dark} />
        <path d={INNER} fill={BG} />
      </g>
      {/* Right half — lighter */}
      <g clipPath="url(#split-right)">
        <path d={OUTER} fill={light} />
        <path d={INNER} fill={BG} />
      </g>
    </svg>
  )
}

// ── 3. Layered A ────────────────────────────────────────────────────
// One bold filled Potra A with a thin outline A offset slightly
// behind/around it. Double-exposure effect — the outline peeks out
// from behind the solid, implying a second A layered underneath.
export function Logo3({ className = 'w-6 h-6', color = '#4f46e5', ...rest }: Props) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="AgentsAccess" role="img" {...rest}>
      <rect width="32" height="32" rx="7" fill={BG} />
      {/* Outline A — offset -1.5, -1 so it peeks out top-left */}
      <g transform="translate(-1.5, -1)">
        <path d={OUTER} stroke={color} strokeWidth="1" strokeLinejoin={M} fill="none" opacity="0.45" />
        <path d={INNER} stroke={color} strokeWidth="0.6" strokeLinejoin={M} fill="none" opacity="0.45" />
      </g>
      {/* Solid A — main mark on top */}
      <path d={OUTER} fill={color} />
      <path d={INNER} fill={BG} />
    </svg>
  )
}

// ── Active export ───────────────────────────────────────────────────
export const AALogo = Logo1
export const AALogoMark = Logo1
