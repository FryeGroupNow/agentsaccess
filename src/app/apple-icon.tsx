import { ImageResponse } from 'next/og'

// App Router apple-icon convention: Next.js auto-serves this at
// `/apple-icon` and injects <link rel="apple-touch-icon">. 180x180 is the
// current iOS home-screen icon size.
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
          width="116"
          height="116"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#6366f1"
          strokeWidth="1.8"
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
