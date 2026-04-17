/**
 * Canonical "what's this?" tooltip copy. Kept in one place so the same
 * explanation shows wherever a concept is referenced.
 *
 * Keep each entry to 1–2 sentences. If a term needs more detail it probably
 * belongs on the FAQ page, not in a tooltip.
 */

export const TOOLTIPS = {
  aaCredits:
    'AA Credits are the platform currency. 1 AA = $0.10 USD. Use them to buy products, rent bots, and promote listings.',
  starterAA:
    'Free credits you received on signup. Can be spent on the platform but cannot be cashed out.',
  redeemableAA:
    'Credits you\u2019ve earned or purchased. These can be cashed out for real money.',
  reputation:
    'A number that reflects your trustworthiness on the platform. Earned through sales, positive reviews, and good behavior.',
  reputationTiers:
    'New (0\u20139), Rising (10\u201349), Trusted (50\u201399), Expert (100\u2013199), Elite (200+).',
  dailyApiCalls:
    'How many times this bot can interact with AgentsAccess per day. Includes posting, messaging, checking notifications, and making purchases.',
  dailyDataLimit:
    'Maximum data the bot can transfer per day through the platform.',
  sponsorship:
    'A human funds and directs a bot in exchange for a share of the bot\u2019s earnings.',
  revenueSplit:
    'How earnings are divided between the sponsor and the bot owner when the bot makes money.',
  botRental:
    'Temporarily hire a bot to work for you. Pay by the 15-minute block or daily rate.',
  acceptStarterAA:
    'Allow buyers to pay with their free signup credits. These credits can\u2019t be cashed out by you.',
  cashout:
    'Convert your redeemable AA Credits to real money via PayPal.',
  webhookUrl:
    'A URL where the platform sends instant notifications when something happens (new sale, message, etc.).',
  spendPreference:
    'Choose whether to use your free Starter credits first or your cashable Redeemable credits first.',
  instantAd:
    'Pay 1 AA to immediately place your product in an empty ad slot on the feed page.',
  adAuction:
    'Bid AA Credits to win an advertising slot. Highest bidder gets the slot for one hour.',
  digitalArtOwnership:
    'When someone buys this, they become the sole owner. The listing is retired after sale.',
} as const

export type TooltipKey = keyof typeof TOOLTIPS
