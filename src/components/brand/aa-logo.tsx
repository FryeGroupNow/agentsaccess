import * as React from 'react'

// AgentsAccess brand mark.
//
// Concept: stylized AA monogram (Agents · Access) inside a hexagonal
// frame. Two letter-A glyphs share a horizontal "network trace" that
// connects two apex nodes — visually echoing two AI agents linked via
// the platform. The hex frame is a tech / circuit-board cue without
// being literal. Indigo-on-dark to match the brand palette.
//
// Two variants:
//   <AALogo />     — full mark with the connection trace + two nodes.
//                    Use in the navbar, footer, auth-page headers,
//                    landing hero, and anywhere ≥ 24px.
//   <AALogoMark /> — compact mark without the connection trace.
//                    Optimised to read at favicon size (16px).
//
// Both variants accept className for sizing; the SVG itself is
// viewBox-driven so it scales cleanly.

interface Props extends React.SVGProps<SVGSVGElement> {
  className?: string
}

export function AALogo({ className = 'w-5 h-5', ...rest }: Props) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="AgentsAccess"
      role="img"
      {...rest}
    >
      {/* Hexagonal frame */}
      <path
        d="M16 2 L28 9 L28 23 L16 30 L4 23 L4 9 Z"
        fill="#0f0f1a"
        stroke="#312e81"
        strokeWidth="0.75"
      />
      {/* Network trace connecting the two A apex nodes */}
      <line
        x1="11"
        y1="9"
        x2="21"
        y2="9"
        stroke="#818cf8"
        strokeWidth="1"
        strokeDasharray="1.5 1.2"
        strokeLinecap="round"
      />
      {/* Left A */}
      <path
        d="M7 24 L11 9 L15 24 M8.8 18.5 L13.2 18.5"
        stroke="#6366f1"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Right A */}
      <path
        d="M17 24 L21 9 L25 24 M18.8 18.5 L23.2 18.5"
        stroke="#6366f1"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Apex nodes — light indigo so they read as "live connections" */}
      <circle cx="11" cy="9" r="1.6" fill="#a5b4fc" />
      <circle cx="21" cy="9" r="1.6" fill="#a5b4fc" />
    </svg>
  )
}

// Compact mark — drop the dashed trace and shrink/thicken the A's so
// they survive a 16x16 favicon render without becoming mush.
export function AALogoMark({ className = 'w-4 h-4', ...rest }: Props) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="AgentsAccess"
      role="img"
      {...rest}
    >
      <rect x="1" y="1" width="30" height="30" rx="6" fill="#0f0f1a" />
      <path
        d="M6 25 L11 7 L16 25 M8.2 18 L13.8 18"
        stroke="#818cf8"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M16 25 L21 7 L26 25 M18.2 18 L23.8 18"
        stroke="#6366f1"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Single shared connection node where the two A's meet */}
      <circle cx="16" cy="6.5" r="2" fill="#a5b4fc" />
    </svg>
  )
}
