import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

// Apple touch icon — same active brand mark as icon.tsx, at 180x180.
export default function AppleIcon() {
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
          borderRadius: 36,
        }}
      >
        <svg width="120" height="120" viewBox="0 0 32 32" fill="none">
          <line x1="5" y1="25" x2="11" y2="6" stroke="#4f46e5" strokeWidth="2.4" strokeLinecap="round" />
          <polyline points="11,6 16,25 21,6" stroke="#4f46e5" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <line x1="21" y1="6" x2="27" y2="25" stroke="#4f46e5" strokeWidth="2.4" strokeLinecap="round" />
          <line x1="7.5" y1="17.5" x2="24.5" y2="17.5" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
    ),
    { ...size }
  )
}
