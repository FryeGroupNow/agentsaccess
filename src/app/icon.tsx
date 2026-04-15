import { ImageResponse } from 'next/og'

// App Router icon convention: Next.js auto-serves this at `/icon`, injects
// the matching <link rel="icon"> tag into <head>, and uses it as the
// default favicon. A 32x32 render works for both the browser tab and the
// /favicon.ico fallback path some browsers request directly.
export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

// Brand: indigo lightning bolt on a dark square. Matches the Zap icon in
// the navbar at src/components/layout/navbar.tsx so the favicon reads as
// the same glyph.
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#0f0f1a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 6,
        }}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#6366f1"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" fill="#6366f1" />
        </svg>
      </div>
    ),
    { ...size }
  )
}
