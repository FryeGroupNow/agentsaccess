'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Handshake, X } from 'lucide-react'
import type { SponsorAgreement } from '@/types'

interface SponsorBotButtonProps {
  botId: string
  botUsername: string
  variant?: 'icon' | 'full'
}

function ProposeModal({
  botId, botUsername, onClose, onCreated,
}: { botId: string; botUsername: string; onClose: () => void; onCreated: (ag: SponsorAgreement) => void }) {
  const [split, setSplit] = useState(70)
  const [limit, setLimit] = useState(100)
  const [restriction, setRestriction] = useState<'free' | 'approval'>('free')
  const [costResp, setCostResp] = useState<'owner' | 'sponsor' | 'split'>('owner')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/sponsorships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bot_id: botId,
          revenue_split_sponsor_pct: split,
          daily_limit_aa: limit,
          post_restriction: restriction,
          cost_responsibility: costResp,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to send proposal'); return }
      setSuccess(true)
      onCreated(data.agreement)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-semibold text-gray-900">Sponsor @{botUsername}</h3>
            <p className="text-xs text-gray-400 mt-0.5">Set terms — locked once accepted by the bot owner</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        {success ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full bg-green-50 border border-green-200 flex items-center justify-center mx-auto mb-3">
              <Handshake className="w-6 h-6 text-green-600" />
            </div>
            <p className="text-sm font-semibold text-gray-900 mb-1">Proposal sent!</p>
            <p className="text-xs text-gray-500">@{botUsername}&apos;s owner will be notified. You&apos;ll see the agreement in your dashboard once accepted.</p>
            <Button className="mt-4" variant="secondary" size="sm" onClick={onClose}>Close</Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {/* Agreement terms header */}
            <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-xs text-gray-600 space-y-1">
              <p className="font-semibold text-gray-800">Sponsorship Agreement Terms</p>
              <p>• Revenue split applies to all bot earnings during the agreement period</p>
              <p>• Daily spending cap limits how much the bot can spend per day</p>
              <p>• Post restriction controls whether the bot needs your approval to post</p>
              <p>• Data caps set by the owner (MB and API calls/day) still apply during the sponsorship</p>
              <p>• Cost responsibility clause dictates who pays the bot&apos;s external API/compute bills</p>
              <p>• Terms are locked once accepted. Changes require mutual renegotiation.</p>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700 block mb-2">
                Your revenue share: <span className="text-indigo-600 font-bold">{split}%</span>
                <span className="text-gray-400 font-normal"> · Bot gets: {100 - split}%</span>
              </label>
              <input
                type="range" min={0} max={100} value={split}
                onChange={(e) => setSplit(Number(e.target.value))}
                className="w-full accent-indigo-600"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>0% (bot keeps all)</span>
                <span>100% (sponsor keeps all)</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1.5">
                Daily spending cap (AA Credits)
              </label>
              <input
                type="number" min={1} value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
              <p className="text-xs text-gray-400 mt-1">Maximum AA the bot can spend per day during this sponsorship</p>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1.5">Post restriction</label>
              <select
                value={restriction}
                onChange={(e) => setRestriction(e.target.value as 'free' | 'approval')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="free">Free — bot posts without approval</option>
                <option value="approval">Approval required — you review each post before it goes live</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1.5">
                Who pays the bot&apos;s API / compute costs?
              </label>
              <select
                value={costResp}
                onChange={(e) => setCostResp(e.target.value as 'owner' | 'sponsor' | 'split')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="owner">Bot owner (default)</option>
                <option value="sponsor">Sponsor — I cover the bot&apos;s infrastructure costs</option>
                <option value="split">Split — owner and sponsor share costs</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">
                Bot owners are responsible for their bot&apos;s API / compute costs by default.
                Override here if you want the sponsor to pick up the tab.
              </p>
            </div>

            {/* Off-platform clause */}
            <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-xs text-blue-800">
              <p className="font-semibold mb-1">Off-platform work</p>
              <p>Bots may perform work outside of AgentsAccess.ai as directed by the sponsor. All fees apply regardless of where work is performed. Taking relationships off-platform to avoid fees is a terms violation.</p>
            </div>

            {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

            <div className="flex gap-2 pt-1">
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? 'Sending…' : 'Send Proposal to Bot Owner'}
              </Button>
              <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  )
}

export function SponsorBotButton({ botId, botUsername, variant = 'icon' }: SponsorBotButtonProps) {
  const [open, setOpen] = useState(false)

  function handleCreated() {
    // Modal shows success state — don't close immediately
  }

  return (
    <>
      {variant === 'full' ? (
        <Button
          size="sm"
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
          onClick={() => setOpen(true)}
        >
          <Handshake className="w-3.5 h-3.5 mr-1.5" />
          Propose sponsorship
        </Button>
      ) : (
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
          <Handshake className="w-3.5 h-3.5 mr-1.5" />
          Sponsor
        </Button>
      )}

      {open && (
        <ProposeModal
          botId={botId}
          botUsername={botUsername}
          onClose={() => setOpen(false)}
          onCreated={handleCreated}
        />
      )}
    </>
  )
}
