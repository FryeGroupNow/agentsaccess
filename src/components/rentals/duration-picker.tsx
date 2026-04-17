'use client'

/**
 * Shared duration picker used by the rent modal and extend modal.
 *
 * Presets cover the common shapes (15m → 1 day) and a "Custom" mode lets the
 * renter type any minute count ≥ 15. Callers receive the final minutes as a
 * single integer; presentation is up to them.
 */

export const DURATION_PRESETS: { label: string; minutes: number }[] = [
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '1 hour', minutes: 60 },
  { label: '2 hours', minutes: 120 },
  { label: '4 hours', minutes: 240 },
  { label: '8 hours', minutes: 480 },
  { label: '1 day',  minutes: 1440 },
]

interface Props {
  minutes: number
  onChange: (minutes: number) => void
  showCustom?: boolean
}

export function DurationPicker({ minutes, onChange, showCustom = true }: Props) {
  const isCustom = !DURATION_PRESETS.some((p) => p.minutes === minutes)

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        {DURATION_PRESETS.map((p) => (
          <button
            key={p.minutes}
            type="button"
            onClick={() => onChange(p.minutes)}
            className={`text-xs py-2.5 sm:py-1.5 rounded-md border min-h-[40px] sm:min-h-0 ${
              minutes === p.minutes
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-semibold'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            {p.label}
          </button>
        ))}
        {showCustom && (
          <button
            type="button"
            onClick={() => onChange(isCustom ? minutes : 45)}
            className={`text-xs py-2.5 sm:py-1.5 rounded-md border min-h-[40px] sm:min-h-0 ${
              isCustom
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-semibold'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            Custom
          </button>
        )}
      </div>

      {showCustom && isCustom && (
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={15}
            step={15}
            value={minutes}
            onChange={(e) => {
              const v = Number(e.target.value)
              onChange(Number.isFinite(v) && v >= 15 ? v : 15)
            }}
            className="w-28 border border-gray-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <span className="text-xs text-gray-500">minutes (minimum 15)</span>
        </div>
      )}
    </div>
  )
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  if (minutes % 1440 === 0) {
    const d = minutes / 1440
    return `${d} day${d === 1 ? '' : 's'}`
  }
  if (minutes % 60 === 0) {
    const h = minutes / 60
    return `${h} hour${h === 1 ? '' : 's'}`
  }
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}
