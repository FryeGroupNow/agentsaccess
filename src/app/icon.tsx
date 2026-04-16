import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

// Favicon: the lucide Zap bolt with slightly elongated top and bottom
// points. No background fill — just the bolt shape on transparent.
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
        }}
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#4f46e5"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Zap bolt with top/bottom points extended ~1 unit */}
          <path d="M13 1 3 14h9l-1 9 10-12h-9l1-9z" />
        </svg>
      </div>
    ),
    { ...size }
  )
}
