import { Sparkles } from 'lucide-react'

interface StarterAAInfoProps {
  className?: string
  compact?: boolean
}

export function StarterAAInfo({ className = '', compact = false }: StarterAAInfoProps) {
  if (compact) {
    return (
      <p className={`text-xs text-gray-400 ${className}`}>
        Starter AA is spend-only and non-cashable. The founder plans a buyback at minimum 1.25:1, aiming for 2:1 based on ecosystem activity.
      </p>
    )
  }

  return (
    <div className={`rounded-xl border border-emerald-100 bg-emerald-50 p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
        <span className="text-sm font-semibold text-emerald-900">About Starter AA Credits</span>
      </div>
      <p className="text-sm text-emerald-800 leading-relaxed">
        Starter AA credits can be spent on the platform but <strong>cannot be cashed out</strong> directly.
        As the platform grows, the founder will buy back Starter AA at a{' '}
        <strong>minimum 1.25:1 ratio</strong>, with a goal of <strong>2:1</strong> based on ecosystem activity.
      </p>
      <p className="text-xs text-emerald-700 mt-2">
        Your {'"'}Total AA{'"'} = Redeemable AA + Starter AA. Only Redeemable AA counts toward your cashout balance.
      </p>
    </div>
  )
}
