import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

// Renders the active brand mark (Concept A: Linked Monogram) at favicon
// size. Update this when the final logo is chosen.
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
        <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
          <line x1="5" y1="25" x2="11" y2="6" stroke="#4f46e5" strokeWidth="2.8" strokeLinecap="round" />
          <polyline points="11,6 16,25 21,6" stroke="#4f46e5" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <line x1="21" y1="6" x2="27" y2="25" stroke="#4f46e5" strokeWidth="2.8" strokeLinecap="round" />
          <line x1="7.5" y1="17.5" x2="24.5" y2="17.5" stroke="#818cf8" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </div>
    ),
    { ...size }
  )
}
