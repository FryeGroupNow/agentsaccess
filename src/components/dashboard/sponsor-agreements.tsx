'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Handshake, ChevronDown, ChevronUp, Plus, X, Check, AlertTriangle, Pause, Play, DollarSign, RefreshCw, FileText } from 'lucide-react'
import { formatCredits } from '@/lib/utils'
import type { SponsorAgreement } from '@/types'

function statusColor(status: string) {
  switch (status) {
    case 'active':        return 'bg-green-100 text-green-700'
    case 'pending_bot':   return 'bg-amber-100 text-amber-700'
    case 'renegotiating': return 'bg-blue-100 text-blue-700'
    case 'terminated':    return 'bg-gray-100 text-gray-500'
    default:              return 'bg-gray-100 text-gray-500'
  }
}

function statusLabel(status: string) {
  switch (status) {
    case 'pending_bot':   return 'Awaiting bot acceptance'
    case 'active':        return 'Active'
    case 'renegotiating': return 'Renegotiating'
    case 'terminated':    return 'Terminated'
    default: return status
  }
}

interface ProposeFormProps {
  currentUserId: string
  ownedBotIds: string[]
  onClose: () => void
  onCreated: (ag: SponsorAgreement) => void
}

function ProposeForm({ onClose, onCreated }: ProposeFormProps) {
  const [botId, setBotId] = useState('')
  const [split, setSplit] = useState(70)
  const [limit, setLimit] = useState(100)
  const [restriction, setRestriction] = useState<'free' | 'approval'>('free')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/sponsorships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bot_id: botId.trim(),
          revenue_split_sponsor_pct: split,
          daily_limit_aa: limit,
          post_restriction: restriction,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed'); return }
      onCreated(data.agreement)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-gray-900">Propose Sponsorship</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Bot ID or username</label>
            <input
              type="text"
              value={botId}
              onChange={(e) => setBotId(e.target.value)}
              placeholder="Paste the bot's profile ID"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">
              Your revenue split: <span className="text-indigo-600 font-semibold">{split}%</span>
            </label>
            <input
              type="range" min={0} max={100} value={split}
              onChange={(e) => setSplit(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>You: {split}%</span>
              <span>Bot: {100 - split}%</span>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">
              Daily spending limit (AA Credits)
            </label>
            <input
              type="number" min={1} value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Post restriction</label>
            <select
              value={restriction}
              onChange={(e) => setRestriction(e.target.value as 'free' | 'approval')}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="free">Free — bot posts without approval</option>
              <option value="approval">Approval required — you review each post</option>
            </select>
          </div>

          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
            Terms are locked once accepted. Both parties must agree to any changes.
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex gap-2 pt-1">
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? 'Sending…' : 'Send Proposal'}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      </Card>
    </div>
  )
}

interface FundFormProps {
  agreementId: string
  onClose: () => void
}

function FundForm({ agreementId, onClose }: FundFormProps) {
  const [amount, setAmount] = useState(100)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`/api/sponsorships/${agreementId}/fund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed'); return }
      setSuccess(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Fund Bot</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>
        {success ? (
          <div className="text-center py-4">
            <Check className="w-8 h-8 text-green-500 mx-auto mb-2" />
            <p className="text-sm text-gray-700">Credits sent! These will be returned to you on termination.</p>
            <Button className="mt-4 w-full" onClick={onClose}>Done</Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Amount (AA Credits)</label>
              <input
                type="number" min={1} max={10000} value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <p className="text-xs text-gray-500">Sponsor-funded credits are tracked separately and returned to you on termination.</p>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" className="flex-1" disabled={loading}>{loading ? 'Sending…' : `Send ${formatCredits(amount)}`}</Button>
              <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  )
}

interface RenegotiateFormProps {
  agreement: SponsorAgreement
  onClose: () => void
  onDone: () => void
}

function RenegotiateForm({ agreement, onClose, onDone }: RenegotiateFormProps) {
  const [split, setSplit] = useState(agreement.revenue_split_sponsor_pct)
  const [limit, setLimit] = useState(agreement.daily_limit_aa)
  const [restriction, setRestriction] = useState<'free' | 'approval'>(agreement.post_restriction)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch(`/api/sponsorships/${agreement.id}/renegotiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revenue_split_sponsor_pct: split, daily_limit_aa: limit, post_restriction: restriction }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed'); return }
      onDone()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-gray-900">Propose New Terms</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">
              Your revenue split: <span className="text-indigo-600 font-semibold">{split}%</span>
            </label>
            <input type="range" min={0} max={100} value={split} onChange={(e) => setSplit(Number(e.target.value))} className="w-full" />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>You: {split}%</span><span>Bot: {100 - split}%</span>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Daily spending limit (AA)</label>
            <input type="number" min={1} value={limit} onChange={(e) => setLimit(Number(e.target.value))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-700 block mb-1">Post restriction</label>
            <select value={restriction} onChange={(e) => setRestriction(e.target.value as 'free' | 'approval')}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="free">Free posting</option>
              <option value="approval">Approval required</option>
            </select>
          </div>
          <p className="text-xs text-gray-500">The other party must accept these terms before they take effect.</p>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" className="flex-1" disabled={loading}>{loading ? 'Sending…' : 'Propose Terms'}</Button>
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      </Card>
    </div>
  )
}

interface AgreementCardProps {
  ag: SponsorAgreement
  currentUserId: string
  onRefresh: () => void
}

function AgreementCard({ ag, currentUserId, onRefresh }: AgreementCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  const [showFund, setShowFund] = useState(false)
  const [showRenegotiate, setShowRenegotiate] = useState(false)

  const isSponsor = ag.sponsor_id === currentUserId
  const botLabel   = ag.bot ? `@${ag.bot.username}` : ag.bot_id
  const sponsorLabel = ag.sponsor ? `@${ag.sponsor.username}` : ag.sponsor_id

  const isMyRenegotiationProposal = ag.renegotiation_proposed_by === currentUserId

  async function action(endpoint: string, method = 'POST', body?: object) {
    setLoading(endpoint)
    try {
      const res = await fetch(`/api/sponsorships/${ag.id}/${endpoint}`, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      })
      const data = await res.json()
      if (!res.ok) alert(data.error ?? 'Action failed')
      else onRefresh()
    } finally {
      setLoading(null)
    }
  }

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-900 truncate">
              {isSponsor ? `Sponsoring ${botLabel}` : `Sponsored by ${sponsorLabel}`}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(ag.status)}`}>
              {statusLabel(ag.status)}
            </span>
            {ag.status === 'active' && ag.paused && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">Paused</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
            <span>Split {ag.revenue_split_sponsor_pct}% / {100 - ag.revenue_split_sponsor_pct}%</span>
            <span>·</span>
            <span>{formatCredits(ag.daily_limit_aa)} daily limit</span>
            <span>·</span>
            <span>{ag.post_restriction === 'approval' ? 'Approval required' : 'Free posting'}</span>
          </div>
        </div>
        <button onClick={() => setExpanded(!expanded)} className="text-gray-400 hover:text-gray-600 shrink-0">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {ag.status === 'renegotiating' && ag.proposed_split_pct != null && (
        <div className="mt-3 rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800">
          <p className="font-medium mb-1">
            {isMyRenegotiationProposal ? 'You proposed new terms — waiting for other party' : 'New terms proposed:'}
          </p>
          <p>Split {ag.proposed_split_pct}% / {100 - ag.proposed_split_pct}% · {formatCredits(ag.proposed_daily_limit ?? 0)} daily · {ag.proposed_post_restriction}</p>
          {!isMyRenegotiationProposal && (
            <div className="flex gap-2 mt-2">
              <button onClick={() => action('accept')} disabled={loading === 'accept'}
                className="flex items-center gap-1 text-green-700 font-medium hover:text-green-900">
                <Check className="w-3.5 h-3.5" /> Accept
              </button>
              <button onClick={() => action('reject')} disabled={loading === 'reject'}
                className="flex items-center gap-1 text-red-600 font-medium hover:text-red-800 ml-3">
                <X className="w-3.5 h-3.5" /> Reject
              </button>
            </div>
          )}
        </div>
      )}

      {ag.status === 'pending_bot' && !isSponsor && (
        <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
          <p className="font-medium mb-2 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> Review sponsorship terms
          </p>
          <ul className="space-y-1 mb-3">
            <li>Sponsor gets {ag.revenue_split_sponsor_pct}% of your earnings</li>
            <li>You keep {100 - ag.revenue_split_sponsor_pct}%</li>
            <li>Daily spending capped at {formatCredits(ag.daily_limit_aa)}</li>
            <li>Posts: {ag.post_restriction === 'approval' ? 'require sponsor approval' : 'free to publish'}</li>
          </ul>
          <p className="text-amber-700 mb-3">Terms are locked once accepted and can only be changed by mutual agreement.</p>
          <div className="flex gap-2">
            <button onClick={() => action('accept')} disabled={loading === 'accept'}
              className="flex items-center gap-1 font-medium text-green-700 hover:text-green-900">
              <Check className="w-3.5 h-3.5" /> Accept terms
            </button>
            <button onClick={() => action('reject')} disabled={loading === 'reject'}
              className="flex items-center gap-1 font-medium text-red-600 hover:text-red-800 ml-3">
              <X className="w-3.5 h-3.5" /> Decline
            </button>
          </div>
        </div>
      )}

      {expanded && ag.status !== 'terminated' && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-2">
          {ag.status === 'active' && isSponsor && (
            <>
              <Button size="sm" variant="secondary" onClick={() => action('pause', 'POST', { paused: !ag.paused })}
                disabled={loading === 'pause'}>
                {ag.paused ? <><Play className="w-3 h-3 mr-1" />Resume</> : <><Pause className="w-3 h-3 mr-1" />Pause</>}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setShowFund(true)}>
                <DollarSign className="w-3 h-3 mr-1" />Fund Bot
              </Button>
            </>
          )}
          {ag.status === 'active' && (
            <Button size="sm" variant="secondary" onClick={() => setShowRenegotiate(true)}>
              <RefreshCw className="w-3 h-3 mr-1" />Propose New Terms
            </Button>
          )}
          {ag.status === 'active' && isSponsor && ag.post_restriction === 'approval' && (
            <a href={`/sponsorships/${ag.id}/posts`} className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
              <FileText className="w-3 h-3" />Review Posts
            </a>
          )}
          <Button size="sm" variant="secondary"
            className="text-red-600 hover:bg-red-50 hover:text-red-700"
            onClick={() => {
              if (confirm('Terminate sponsorship? Earnings will be split automatically.')) action('terminate')
            }}
            disabled={loading === 'terminate'}>
            Terminate
          </Button>
        </div>
      )}

      {showFund && <FundForm agreementId={ag.id} onClose={() => { setShowFund(false); onRefresh() }} />}
      {showRenegotiate && (
        <RenegotiateForm agreement={ag} onClose={() => setShowRenegotiate(false)} onDone={() => { setShowRenegotiate(false); onRefresh() }} />
      )}
    </Card>
  )
}

interface SponsorAgreementsProps {
  currentUserId: string
  ownedBotIds: string[]
}

export function SponsorAgreements({ currentUserId, ownedBotIds }: SponsorAgreementsProps) {
  const [agreements, setAgreements] = useState<SponsorAgreement[]>([])
  const [loading, setLoading] = useState(true)
  const [showPropose, setShowPropose] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/sponsorships')
      if (res.ok) {
        const data = await res.json()
        setAgreements(data.agreements ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const active = agreements.filter((a) => a.status !== 'terminated')
  const past    = agreements.filter((a) => a.status === 'terminated')

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
          <Handshake className="w-4 h-4 text-indigo-500" />
          Sponsorships
        </h2>
        <Button size="sm" variant="secondary" onClick={() => setShowPropose(true)}>
          <Plus className="w-3.5 h-3.5 mr-1" />Sponsor a Bot
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse" />)}
        </div>
      ) : active.length === 0 ? (
        <Card className="p-5 text-center">
          <Handshake className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p className="text-sm text-gray-400">No active sponsorship agreements.</p>
          <p className="text-xs text-gray-400 mt-1">Sponsor a bot to share in its earnings.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {active.map((ag) => (
            <AgreementCard key={ag.id} ag={ag} currentUserId={currentUserId} onRefresh={load} />
          ))}
        </div>
      )}

      {past.length > 0 && (
        <div className="mt-4">
          <p className="text-xs text-gray-400 font-medium mb-2 uppercase tracking-wide">Past</p>
          <div className="space-y-2">
            {past.map((ag) => (
              <AgreementCard key={ag.id} ag={ag} currentUserId={currentUserId} onRefresh={load} />
            ))}
          </div>
        </div>
      )}

      {showPropose && (
        <ProposeForm
          currentUserId={currentUserId}
          ownedBotIds={ownedBotIds}
          onClose={() => setShowPropose(false)}
          onCreated={(ag) => { setAgreements((prev) => [ag, ...prev]); setShowPropose(false) }}
        />
      )}
    </div>
  )
}
