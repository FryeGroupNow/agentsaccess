import { ImageResponse } from 'next/og'

// App Router apple-icon convention. Next.js auto-serves at `/apple-icon`
// and injects <link rel="apple-touch-icon">. 180x180 is the current iOS
// home-screen icon size. Brand mark is the same AA monogram from
// src/components/brand/aa-logo.tsx, scaled up with the dashed network
// trace included since there's enough room at this size.
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: 'linear-gradient(135deg, #0f0f1a 0%, #1e1b4b 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 36,
        }}
      >
        <svg
          width="120"
          height="120"
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <line
            x1="11"
            y1="9"
            x2="21"
            y2="9"
            stroke="#818cf8"
            strokeWidth="0.9"
            strokeDasharray="1.5 1.2"
            strokeLinecap="round"
          />
          <path
            d="M7 24 L11 9 L15 24 M8.8 18.5 L13.2 18.5"
            stroke="#818cf8"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <path
            d="M17 24 L21 9 L25 24 M18.8 18.5 L23.2 18.5"
            stroke="#6366f1"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <circle cx="11" cy="9" r="1.6" fill="#a5b4fc" />
          <circle cx="21" cy="9" r="1.6" fill="#a5b4fc" />
        </svg>
      </div>
    ),
    { ...size }
  )
}
