'use client'

import { useState, useEffect } from 'react'
import { Copy, Check, UserPlus, Gift } from 'lucide-react'

interface Referral {
  id: string
  created_at: string
  bonus_granted: boolean
  invitee: {
    id: string
    username: string
    display_name: string
    user_type: string
  } | null
}

interface InviteData {
  invite_code: string
  referral_count: number
  referrals: Referral[]
  invite_url: string
}

export function InviteSection({ hideHeader = false }: { hideHeader?: boolean }) {
  const [data, setData] = useState<InviteData | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch('/api/invites')
      .then((r) => r.json())
      .then((body) => {
        if (body?.invite_code) setData(body as InviteData)
      })
      .catch(() => {})
  }, [])

  async function copyLink() {
    if (!data?.invite_url) return
    await navigator.clipboard.writeText(data.invite_url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!data) return null

  return (
    <div className="space-y-4">
      {!hideHeader && (
        <div className="flex items-center gap-2">
          <Gift className="w-4 h-4 text-indigo-500" />
          <h2 className="text-base font-semibold text-gray-900">Invite friends</h2>
        </div>
      )}

      <div className="bg-indigo-50 rounded-xl p-4 space-y-3">
        <p className="text-sm text-indigo-800">
          Share your invite link. Both you and your friend get <strong>5 bonus AA Credits</strong> when they sign up.
        </p>

        <div className="flex gap-2">
          <div className="flex-1 bg-white rounded-lg px-3 py-2 text-sm text-gray-600 border border-indigo-100 truncate font-mono">
            {data.invite_url}
          </div>
          <button
            onClick={copyLink}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex-shrink-0 ${
              copied
                ? 'bg-green-100 text-green-700'
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}
          >
            {copied ? <><Check className="w-3.5 h-3.5" />Copied!</> : <><Copy className="w-3.5 h-3.5" />Copy</>}
          </button>
        </div>

        <p className="text-xs text-indigo-600">
          Your code: <strong>{data.invite_code}</strong> · {data.referral_count} friend{data.referral_count !== 1 ? 's' : ''} invited
        </p>
      </div>

      {data.referrals.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Referrals</h3>
          <div className="space-y-1.5">
            {data.referrals.map((r) => (
              <div key={r.id} className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 px-3 py-2.5">
                <UserPlus className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{r.invitee?.display_name}</p>
                  <p className="text-xs text-gray-400">@{r.invitee?.username}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  {r.bonus_granted ? (
                    <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                      <Check className="w-3 h-3" />+5 AA
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">Pending</span>
                  )}
                  <p className="text-[10px] text-gray-300">{new Date(r.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
