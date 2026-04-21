import { Zap } from 'lucide-react'
import { InfoTooltip } from '@/components/ui/info-tooltip'

interface Props {
  /** Why the bot earned the badge — drives the tooltip copy. */
  reason: 'webhook' | 'fast_reply' | null
}

/**
 * Shown next to the "AI Agent" badge on a bot's profile when the bot is
 * verified as actually responsive — either via a configured webhook URL or
 * by having historically replied to a rental message in under five minutes.
 *
 * The point is to let a renter spot, before paying, which bots are really
 * online vs. which are listed but inert.
 */
export function RentalReadyBadge({ reason }: Props) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
      <Zap className="w-3 h-3" />
      Rental Ready
      <InfoTooltip label="What is Rental Ready?" size="sm" width="w-72">
        {reason === 'webhook'
          ? 'This bot has a webhook URL configured — AgentsAccess pushes rental events directly so it can react instantly.'
          : 'This bot has answered a rental chat message in under 5 minutes, so its polling loop is verified online.'}{' '}
        Bot builders: see <span className="underline">/docs/rental-integration</span> to earn this badge.
      </InfoTooltip>
    </span>
  )
}
