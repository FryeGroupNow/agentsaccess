import { Star } from 'lucide-react'

interface ReputationBadgeProps {
  score: number
  size?: 'xs' | 'sm' | 'md' | 'lg'
  /** Hide the tier label and show only the number. Defaults to false (label visible). */
  hideLabel?: boolean
  className?: string
}

// Color coding per spec:
//   New      (<10)   — gray
//   Rising   (10-49) — blue
//   Trusted  (50-99) — green
//   Expert   (100-199) — purple
//   Elite    (200+)  — gold
function getRepTier(score: number) {
  if (score >= 200) return {
    label: 'Elite',
    ring: 'border-amber-300',
    bg:   'bg-amber-50',
    text: 'text-amber-700',
    bar:  'bg-amber-400',
    star: 'text-amber-500 fill-amber-400',
  }
  if (score >= 100) return {
    label: 'Expert',
    ring: 'border-purple-300',
    bg:   'bg-purple-50',
    text: 'text-purple-700',
    bar:  'bg-purple-500',
    star: 'text-purple-500 fill-purple-400',
  }
  if (score >= 50) return {
    label: 'Trusted',
    ring: 'border-emerald-300',
    bg:   'bg-emerald-50',
    text: 'text-emerald-700',
    bar:  'bg-emerald-500',
    star: 'text-emerald-500 fill-emerald-400',
  }
  if (score >= 10) return {
    label: 'Rising',
    ring: 'border-sky-300',
    bg:   'bg-sky-50',
    text: 'text-sky-700',
    bar:  'bg-sky-500',
    star: 'text-sky-500 fill-sky-400',
  }
  return {
    label: 'New',
    ring: 'border-gray-200',
    bg:   'bg-gray-50',
    text: 'text-gray-600',
    bar:  'bg-gray-300',
    star: 'text-gray-400 fill-gray-300',
  }
}

export function ReputationBadge({ score, size = 'md', hideLabel = false, className = '' }: ReputationBadgeProps) {
  const tier = getRepTier(score)
  // Progress bar scaled to 300 max (Elite ceiling)
  const pct = Math.min(100, (score / 300) * 100)
  const rounded = Math.round(score)

  if (size === 'xs') {
    return (
      <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${tier.text} ${className}`}>
        <Star className={`w-2.5 h-2.5 ${tier.star}`} />
        {rounded}
        {!hideLabel && <span className="opacity-80 font-medium">· {tier.label}</span>}
      </span>
    )
  }

  if (size === 'sm') {
    return (
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[11px] font-semibold ${tier.ring} ${tier.bg} ${tier.text} ${className}`}>
        <Star className={`w-3 h-3 ${tier.star}`} />
        {rounded}
        {!hideLabel && <span className="font-medium opacity-80">· {tier.label}</span>}
      </span>
    )
  }

  if (size === 'lg') {
    return (
      <div className={`inline-flex flex-col items-start gap-1.5 ${className}`}>
        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 ${tier.ring} ${tier.bg} shadow-sm`}>
          <Star className={`w-6 h-6 ${tier.star}`} />
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-black ${tier.text} leading-none`}>{rounded}</span>
            <span className={`text-sm font-bold uppercase tracking-wider ${tier.text} opacity-80`}>{tier.label}</span>
          </div>
        </div>
        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full ${tier.bar} rounded-full transition-all`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    )
  }

  // md (default)
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold ${tier.ring} ${tier.bg} ${tier.text} ${className}`}>
      <Star className={`w-3.5 h-3.5 ${tier.star}`} />
      {rounded}
      {!hideLabel && <span className="font-semibold opacity-80">— {tier.label}</span>}
    </span>
  )
}
