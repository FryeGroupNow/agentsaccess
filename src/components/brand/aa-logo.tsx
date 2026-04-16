import * as React from 'react'

// ─────────────────────────────────────────────────────────────────────
// AgentsAccess brand mark — 5 concepts for review (round 2).
//
// Primary: #4f46e5 (indigo-600). Accent: #818cf8 (indigo-400).
// All on #0f0f1a dark rounded-square frame, viewBox 0 0 32 32.
// ─────────────────────────────────────────────────────────────────────

interface Props extends React.SVGProps<SVGSVGElement> {
  className?: string
}

const P = '#4f46e5'
const A = '#818cf8'

// ── 1. Stacked AA ───────────────────────────────────────────────────
// One A stacked on top of another. Sharp chevron shapes, reads as a
// monolith/pillar from afar, two distinct A's up close. The bottom A
// is larger (grounding), the top A is smaller (ascending).
export function LogoStackedAA({ className = 'w-6 h-6', ...rest }: Props) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="AgentsAccess" role="img" {...rest}>
      <rect width="32" height="32" rx="7" fill="#0f0f1a" />
      {/* Top A — smaller */}
      <path d="M16 4 L10.5 14 L21.5 14 Z" stroke={A} strokeWidth="2" strokeLinejoin="round" fill="none" />
      <line x1="12.8" y1="11" x2="19.2" y2="11" stroke={A} strokeWidth="1.5" strokeLinecap="round" />
      {/* Bottom A — larger */}
      <path d="M16 13 L7 27 L25 27 Z" stroke={P} strokeWidth="2" strokeLinejoin="round" fill="none" />
      <line x1="10.5" y1="22" x2="21.5" y2="22" stroke={P} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

// ── 2. Bot A ────────────────────────────────────────────────────────
// The letter A where the two legs are literal bot legs, the crossbar
// is the body/torso, and two small circles sit above as eyes. The
// apex is the head point. Reads as both "A" and a walking bot.
export function LogoBotA({ className = 'w-6 h-6', ...rest }: Props) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="AgentsAccess" role="img" {...rest}>
      <rect width="32" height="32" rx="7" fill="#0f0f1a" />
      {/* Antenna */}
      <line x1="16" y1="3" x2="16" y2="7" stroke={A} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="16" cy="3" r="1.2" fill={A} />
      {/* Head / apex */}
      <line x1="16" y1="7" x2="9" y2="19" stroke={P} strokeWidth="2.2" strokeLinecap="round" />
      <line x1="16" y1="7" x2="23" y2="19" stroke={P} strokeWidth="2.2" strokeLinecap="round" />
      {/* Eyes */}
      <circle cx="13" cy="13" r="1.5" fill={A} />
      <circle cx="19" cy="13" r="1.5" fill={A} />
      {/* Body / crossbar */}
      <line x1="10.5" y1="17" x2="21.5" y2="17" stroke={P} strokeWidth="2.2" strokeLinecap="round" />
      {/* Bot legs — splayed outward with feet */}
      <line x1="12" y1="19" x2="8" y2="27" stroke={P} strokeWidth="2.2" strokeLinecap="round" />
      <line x1="20" y1="19" x2="24" y2="27" stroke={P} strokeWidth="2.2" strokeLinecap="round" />
      {/* Feet */}
      <line x1="6" y1="27" x2="10" y2="27" stroke={A} strokeWidth="2" strokeLinecap="round" />
      <line x1="22" y1="27" x2="26" y2="27" stroke={A} strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

// ── 3. Circuit A ────────────────────────────────────────────────────
// The letter A drawn from right-angle circuit traces with solder-dot
// nodes at every vertex. Pure PCB aesthetic, reads as "A" with a
// tech overlay. Traces are orthogonal where possible.
export function LogoCircuitA({ className = 'w-6 h-6', ...rest }: Props) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="AgentsAccess" role="img" {...rest}>
      <rect width="32" height="32" rx="7" fill="#0f0f1a" />
      {/* A drawn as circuit traces — left leg goes up-then-right to apex,
          right leg mirrors. Crossbar is a horizontal trace with dots. */}
      {/* Left leg: bottom-left → up → right to apex */}
      <polyline
        points="7,27 7,10 16,5"
        stroke={P} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"
      />
      {/* Right leg: apex → right → down to bottom-right */}
      <polyline
        points="16,5 25,10 25,27"
        stroke={P} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"
      />
      {/* Crossbar trace */}
      <line x1="7" y1="18" x2="25" y2="18" stroke={A} strokeWidth="1.8" strokeLinecap="round" />
      {/* Solder dots at all vertices */}
      <circle cx="7" cy="27" r="1.8" fill={A} />
      <circle cx="7" cy="10" r="1.8" fill={A} />
      <circle cx="16" cy="5" r="2" fill={P} />
      <circle cx="25" cy="10" r="1.8" fill={A} />
      <circle cx="25" cy="27" r="1.8" fill={A} />
      <circle cx="7" cy="18" r="1.4" fill={A} />
      <circle cx="25" cy="18" r="1.4" fill={A} />
    </svg>
  )
}

// ── 4. Portal A ─────────────────────────────────────────────────────
// Two parallel strokes forming an A-shaped doorway/portal. The space
// between the strokes is filled with a lighter tone suggesting depth
// or passage. Agents walk through into the economy.
export function LogoPortalA({ className = 'w-6 h-6', ...rest }: Props) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="AgentsAccess" role="img" {...rest}>
      <rect width="32" height="32" rx="7" fill="#0f0f1a" />
      {/* Inner portal fill — the negative space that reads as a doorway */}
      <path d="M16 5 L9 27 L23 27 Z" fill="#312e81" />
      {/* Outer A */}
      <path d="M16 3 L5 28 L27 28 Z" stroke={P} strokeWidth="2" strokeLinejoin="round" fill="none" />
      {/* Inner A (parallel, smaller) — creates the "two-stroke" portal feel */}
      <path d="M16 9 L10.5 25 L21.5 25 Z" stroke={A} strokeWidth="1.4" strokeLinejoin="round" fill="none" />
      {/* Crossbar spanning both — the threshold */}
      <line x1="8" y1="20" x2="24" y2="20" stroke={P} strokeWidth="2" strokeLinecap="round" />
      {/* Floor line of inner portal */}
      <line x1="12" y1="23" x2="20" y2="23" stroke={A} strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

// ── 5. Agent Badge ──────────────────────────────────────────────────
// Shield / badge outline with "AA" typeset inside. Professional,
// official — like a verified-agent credential. Clean shield contour
// with a flat top and pointed bottom.
export function LogoAgentBadge({ className = 'w-6 h-6', ...rest }: Props) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="AgentsAccess" role="img" {...rest}>
      <rect width="32" height="32" rx="7" fill="#0f0f1a" />
      {/* Shield outline */}
      <path
        d="M16 3 L5 8 L5 17 Q5 26 16 29 Q27 26 27 17 L27 8 Z"
        stroke={P} strokeWidth="1.8" strokeLinejoin="round" fill="none"
      />
      {/* Inner shield fill — subtle depth */}
      <path
        d="M16 5.5 L7 9.5 L7 17 Q7 24.5 16 27 Q25 24.5 25 17 L25 9.5 Z"
        fill="#1e1b4b"
      />
      {/* "AA" text — two small, clean A shapes side by side */}
      {/* Left A */}
      <path d="M9 22 L12.5 11 L16 22 M10.5 19 L14.5 19" stroke={A} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Right A */}
      <path d="M16 22 L19.5 11 L23 22 M17.5 19 L21.5 19" stroke={P} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Top accent — small star/dot at shield peak */}
      <circle cx="16" cy="8" r="1.2" fill={A} />
    </svg>
  )
}

// ── Active export ───────────────────────────────────────────────────
// Aliased to Concept 1 by default. Change after picking.
export const AALogo = LogoStackedAA
export const AALogoMark = LogoStackedAA
