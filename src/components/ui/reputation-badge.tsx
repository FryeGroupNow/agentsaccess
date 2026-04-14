import { Star } from 'lucide-react'

interface ReputationBadgeProps {
  score: number
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  className?: string
}

function getRepTier(score: number) {
  if (score >= 200) return { label: 'Elite',   ring: 'border-purple-300', bg: 'bg-purple-50',  text: 'text-purple-700', bar: 'bg-purple-500',  star: 'text-purple-500 fill-purple-500' }
  if (score >= 100) return { label: 'Expert',  ring: 'border-indigo-300', bg: 'bg-indigo-50',  text: 'text-indigo-700', bar: 'bg-indigo-500',  star: 'text-indigo-500 fill-indigo-500' }
  if (score >= 50)  return { label: 'Trusted', ring: 'border-amber-300',  bg: 'bg-amber-50',   text: 'text-amber-700',  bar: 'bg-amber-400',   star: 'text-amber-400 fill-amber-400' }
  if (score >= 10)  return { label: 'Rising',  ring: 'border-emerald-300',bg: 'bg-emerald-50', text: 'text-emerald-700',bar: 'bg-emerald-400', star: 'text-emerald-500 fill-emerald-500' }
  return              { label: 'New',     ring: 'border-gray-200',  bg: 'bg-gray-50',    text: 'text-gray-500',   bar: 'bg-gray-300',    star: 'text-gray-400 fill-gray-300' }
}

export function ReputationBadge({ score, size = 'md', showLabel = false, className = '' }: ReputationBadgeProps) {
  const tier = getRepTier(score)
  // Cap bar at 100% — scale to max 300 for Elite
  const pct = Math.min(100, (score / 300) * 100)

  if (size === 'sm') {
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-semibold ${tier.text} ${className}`}>
        <Star className={`w-3 h-3 ${tier.star}`} />
        {score.toFixed(0)}
        {showLabel && <span className="font-normal opacity-70">{tier.label}</span>}
      </span>
    )
  }

  if (size === 'lg') {
    return (
      <div className={`inline-flex flex-col items-center gap-1 ${className}`}>
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border ${tier.ring} ${tier.bg}`}>
          <Star className={`w-5 h-5 ${tier.star}`} />
          <span className={`text-2xl font-black ${tier.text}`}>{score.toFixed(0)}</span>
          <span className={`text-xs font-semibold ${tier.text} opacity-70`}>{tier.label}</span>
        </div>
        {/* Progress bar */}
        <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full ${tier.bar} rounded-full transition-all`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    )
  }

  // md (default)
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-semibold ${tier.ring} ${tier.bg} ${tier.text} ${className}`}>
      <Star className={`w-3 h-3 ${tier.star}`} />
      {score.toFixed(0)}
      {showLabel && <span className="font-normal opacity-80">{tier.label}</span>}
    </span>
  )
}
