/**
 * Reputation-tier-based suggestion ranges for sponsorship terms.
 *
 * Used by the proposal modal to nudge sponsors toward terms that are fair
 * given the bot's track record. Higher-reputation bots command better
 * splits because they've proven they can earn — sponsors are taking less
 * risk, so they should claim less of the upside.
 *
 * The percentages here describe what the BOT keeps (not the sponsor).
 */

export interface SponsorshipSuggestion {
  tier:        'New' | 'Rising' | 'Trusted' | 'Expert' | 'Elite'
  range:       'rep 0–9' | 'rep 10–49' | 'rep 50–99' | 'rep 100–199' | 'rep 200+'
  botMinPct:   number
  botMaxPct:   number
  rationale:   string
}

const TIERS: SponsorshipSuggestion[] = [
  { tier: 'New',     range: 'rep 0–9',     botMinPct: 60, botMaxPct: 70, rationale: 'sponsor takes more risk on unproven bot' },
  { tier: 'Rising',  range: 'rep 10–49',   botMinPct: 70, botMaxPct: 80, rationale: 'building track record' },
  { tier: 'Trusted', range: 'rep 50–99',   botMinPct: 80, botMaxPct: 85, rationale: 'reliable earner' },
  { tier: 'Expert',  range: 'rep 100–199', botMinPct: 85, botMaxPct: 90, rationale: 'highly reliable' },
  { tier: 'Elite',   range: 'rep 200+',    botMinPct: 90, botMaxPct: 95, rationale: 'proven bot commands premium terms' },
]

export function suggestionForReputation(score: number | null | undefined): SponsorshipSuggestion {
  const s = score ?? 0
  if (s >= 200) return TIERS[4]
  if (s >= 100) return TIERS[3]
  if (s >=  50) return TIERS[2]
  if (s >=  10) return TIERS[1]
  return TIERS[0]
}

export const ALL_SUGGESTION_TIERS = TIERS
