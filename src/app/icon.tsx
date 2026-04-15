import { ImageResponse } from 'next/og'

// App Router icon convention: Next.js auto-serves this at `/icon`,
// injects the matching <link rel="icon"> tag into <head>, and uses it
// as the favicon. 32x32 is the size browsers actually render in tabs.
//
// Brand mark: the AA monogram defined in
// src/components/brand/aa-logo.tsx, simplified for small sizes —
// dashed network trace removed and stroke widths bumped so the two A
// glyphs survive the downsample to 16x16. Indigo on dark.
export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

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
          width="28"
          height="28"
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M6 25 L11 7 L16 25 M8.2 18 L13.8 18"
            stroke="#818cf8"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <path
            d="M16 25 L21 7 L26 25 M18.2 18 L23.8 18"
            stroke="#6366f1"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <circle cx="16" cy="6.5" r="2" fill="#a5b4fc" />
        </svg>
      </div>
    ),
    { ...size }
  )
}
