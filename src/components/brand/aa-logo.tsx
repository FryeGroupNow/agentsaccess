import * as React from 'react'

// ─────────────────────────────────────────────────────────────────────
// AgentsAccess brand mark — three concepts for review.
//
// All three use #4f46e5 (indigo-600) as primary. Each concept exports
// a full-size variant and is designed to be legible at favicon (16px).
//
//   Concept A — "Linked Monogram"
//     Two geometric A's sharing a center stroke, connected by a single
//     crossbar. Clean typographic ligature. Reads AA instantly.
//
//   Concept B — "Network Hub"
//     Central node with radiating connection lines to 4 outer nodes.
//     Abstract agent-network mark. No letterforms.
//
//   Concept C — "Agent Visor"
//     Rounded square with a horizontal slit and two dot-eyes. Reads as
//     a minimal bot/agent face. Distinctive silhouette.
//
// Pick one → rename it to AALogo and remove the others.
// ─────────────────────────────────────────────────────────────────────

interface Props extends React.SVGProps<SVGSVGElement> {
  className?: string
}

const C = '#4f46e5'  // indigo-600
const C2 = '#818cf8' // indigo-400

// ── Concept A: Linked Monogram ──────────────────────────────────────
// Two A's share the center leg. Their crossbars merge into one line.
// The inner strokes meet at a base vertex forming a clean V.
export function LogoConceptA({ className = 'w-6 h-6', ...rest }: Props) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="AgentsAccess" role="img" {...rest}>
      <rect width="32" height="32" rx="7" fill="#0f0f1a" />
      {/* Left A outer leg */}
      <line x1="5" y1="25" x2="11" y2="6" stroke={C} strokeWidth="2.4" strokeLinecap="round" />
      {/* Shared V: left-A right leg + right-A left leg, meeting at bottom center */}
      <polyline points="11,6 16,25 21,6" stroke={C} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Right A outer leg */}
      <line x1="21" y1="6" x2="27" y2="25" stroke={C} strokeWidth="2.4" strokeLinecap="round" />
      {/* Single connected crossbar spanning both A's */}
      <line x1="7.5" y1="17.5" x2="24.5" y2="17.5" stroke={C2} strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

// ── Concept B: Network Hub ──────────────────────────────────────────
// Central agent node with 4 connections radiating outward. Abstract,
// modern, no letterforms. Reads as "connected network."
export function LogoConceptB({ className = 'w-6 h-6', ...rest }: Props) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="AgentsAccess" role="img" {...rest}>
      <rect width="32" height="32" rx="7" fill="#0f0f1a" />
      {/* Connection lines */}
      <line x1="16" y1="16" x2="7" y2="7" stroke={C2} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="16" y1="16" x2="25" y2="7" stroke={C2} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="16" y1="16" x2="7" y2="25" stroke={C2} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="16" y1="16" x2="25" y2="25" stroke={C2} strokeWidth="1.5" strokeLinecap="round" />
      {/* Outer nodes */}
      <circle cx="7" cy="7" r="2.5" fill={C} />
      <circle cx="25" cy="7" r="2.5" fill={C} />
      <circle cx="7" cy="25" r="2.5" fill={C} />
      <circle cx="25" cy="25" r="2.5" fill={C} />
      {/* Central hub — larger, lighter */}
      <circle cx="16" cy="16" r="4" fill={C} />
      <circle cx="16" cy="16" r="2" fill={C2} />
    </svg>
  )
}

// ── Concept C: Agent Visor ──────────────────────────────────────────
// Rounded square with a horizontal visor slit and two dot-eyes.
// Reads as a minimal agent/bot face. Distinctive silhouette at any
// size. Think: futuristic helmet more than cartoon face.
export function LogoConceptC({ className = 'w-6 h-6', ...rest }: Props) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-label="AgentsAccess" role="img" {...rest}>
      <rect width="32" height="32" rx="7" fill="#0f0f1a" />
      {/* Agent head — rounded rect, centered */}
      <rect x="6" y="6" width="20" height="20" rx="6" fill="none" stroke={C} strokeWidth="2" />
      {/* Visor slit */}
      <line x1="9" y1="16" x2="23" y2="16" stroke={C2} strokeWidth="2" strokeLinecap="round" />
      {/* Eyes — two filled dots above the visor */}
      <circle cx="12" cy="12" r="2" fill={C} />
      <circle cx="20" cy="12" r="2" fill={C} />
      {/* Subtle chin indicator */}
      <line x1="13" y1="21" x2="19" y2="21" stroke={C} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

// ── Active export ───────────────────────────────────────────────────
// Currently aliased to Concept A. Change this line after picking.
export const AALogo = LogoConceptA
export const AALogoMark = LogoConceptA
