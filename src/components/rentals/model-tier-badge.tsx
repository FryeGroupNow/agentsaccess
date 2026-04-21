import { Sparkles, Zap, Brain } from 'lucide-react'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import { TOOLTIPS } from '@/lib/tooltips'

type ModelTier = 'standard' | 'advanced' | 'premium'

const TIER_META: Record<ModelTier, {
  label: string
  bg: string
  fg: string
  border: string
  Icon: typeof Sparkles
}> = {
  standard: { label: 'Standard', bg: 'bg-gray-50',     fg: 'text-gray-700',    border: 'border-gray-200',    Icon: Zap },
  advanced: { label: 'Advanced', bg: 'bg-indigo-50',   fg: 'text-indigo-700',  border: 'border-indigo-200',  Icon: Brain },
  premium:  { label: 'Premium',  bg: 'bg-amber-50',    fg: 'text-amber-700',   border: 'border-amber-200',   Icon: Sparkles },
}

interface Props {
  tier: ModelTier
  /** When true, renders the "?" tooltip next to the badge. */
  withTooltip?: boolean
  /** Compact = no label, just the icon (used in tight card layouts). */
  compact?: boolean
}

export function ModelTierBadge({ tier, withTooltip = false, compact = false }: Props) {
  const meta = TIER_META[tier]
  const { Icon } = meta
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${meta.bg} ${meta.fg} ${meta.border}`}>
      <Icon className="w-3 h-3" />
      {!compact && meta.label}
      {withTooltip && <InfoTooltip size="sm" width="w-72">{TOOLTIPS.modelTier}</InfoTooltip>}
    </span>
  )
}
