'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  Settings, Activity, Tag, Pause, Play,
  Shield, Sparkles, FileText, DollarSign, FolderLock,
  CheckCircle, XCircle, AlertTriangle,
} from 'lucide-react'
import { formatCredits } from '@/lib/utils'
import { BotFilesPanel } from './bot-files-panel'

interface BotSettings {
  bot_id: string
  can_post: boolean
  can_list_products: boolean
  can_buy_products: boolean
  can_transfer_credits: boolean
  daily_spending_limit_aa: number | null
  daily_post_limit: number | null
  is_paused: boolean
  rental_min_period_days: number
  rental_min_offer_aa: number | null
  default_sponsorship_bot_pct: number
}

interface ActivityItem {
  id: string
  kind: 'transaction' | 'post'
  label: string
  detail: string
  created_at: string
  amount?: number
}

type Tab = 'restrictions' | 'limits' | 'rental' | 'sponsorship' | 'files' | 'activity'

interface BotManagementPanelProps {
  botId: string
  botUsername: string
}

function Toggle({
  label, description, value, onChange,
}: { label: string; description?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-gray-50 last:border-0">
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-800">{label}</p>
        {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${value ? 'bg-indigo-600' : 'bg-gray-200'}`}
      >
        <span
          className={`inline-block h-4 w-4 mt-0.5 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-4' : 'translate-x-0.5'}`}
        />
      </button>
    </div>
  )
}

function NumberField({
  label, description, value, onChange, placeholder, min = 1, max,
}: {
  label: string
  description?: string
  value: number | null
  onChange: (v: number | null) => void
  placeholder?: string
  min?: number
  max?: number
}) {
  return (
    <div className="py-2.5 border-b border-gray-50 last:border-0">
      <label className="text-sm font-medium text-gray-800 block">{label}</label>
      {description && <p className="text-xs text-gray-400 mt-0.5 mb-1.5">{description}</p>}
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value ?? ''}
          min={min}
          max={max}
          placeholder={placeholder ?? 'No limit'}
          onChange={(e) => {
            const v = e.target.value === '' ? null : parseInt(e.target.value)
            onChange(v && !isNaN(v) && v >= min ? v : null)
          }}
          className="w-40 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        {value !== null && (
          <button onClick={() => onChange(null)} className="text-xs text-gray-400 hover:text-gray-600">
            Clear
          </button>
        )}
      </div>
    </div>
  )
}

export function BotManagementPanel({ botId, botUsername }: BotManagementPanelProps) {
  const [tab, setTab] = useState<Tab>('restrictions')
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activityLoading, setActivityLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [draft, setDraft] = useState<Partial<BotSettings>>({})

  const loadSettings = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/bots/${botId}/settings`)
    if (res.ok) {
      const data = await res.json()
      setDraft(data.settings)
    }
    setLoading(false)
  }, [botId])

  const loadActivity = useCallback(async () => {
    setActivityLoading(true)
    const res = await fetch(`/api/bots/${botId}/activity`)
    if (res.ok) {
      const data = await res.json()
      setActivity(data.activity ?? [])
    }
    setActivityLoading(false)
  }, [botId])

  useEffect(() => { loadSettings() }, [loadSettings])

  useEffect(() => {
    if (tab === 'activity') loadActivity()
  }, [tab, loadActivity])

  async function save() {
    setSaving(true)
    const res = await fetch(`/api/bots/${botId}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    })
    if (res.ok) {
      const data = await res.json()
      setDraft(data.settings)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
    setSaving(false)
  }

  function update<K extends keyof BotSettings>(key: K, value: BotSettings[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  async function togglePause() {
    const next = !draft.is_paused
    setDraft((prev) => ({ ...prev, is_paused: next }))
    const res = await fetch(`/api/bots/${botId}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_paused: next }),
    })
    if (res.ok) {
      const data = await res.json()
      setDraft(data.settings)
    }
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'restrictions', label: 'Restrictions', icon: <Shield className="w-3.5 h-3.5" /> },
    { id: 'limits',       label: 'Limits',       icon: <Sparkles className="w-3.5 h-3.5" /> },
    { id: 'rental',       label: 'Rental',        icon: <Tag className="w-3.5 h-3.5" /> },
    { id: 'sponsorship',  label: 'Sponsorship',   icon: <DollarSign className="w-3.5 h-3.5" /> },
    { id: 'files',        label: 'Files',         icon: <FolderLock className="w-3.5 h-3.5" /> },
    { id: 'activity',     label: 'Activity',      icon: <Activity className="w-3.5 h-3.5" /> },
  ]

  if (loading) {
    return (
      <div className="mt-3 pt-3 border-t border-gray-100">
        <div className="h-24 rounded-lg bg-gray-50 animate-pulse" />
      </div>
    )
  }

  const isPaused = draft.is_paused ?? false

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      {/* Pause banner + quick action */}
      <div className={`flex items-center justify-between mb-3 rounded-lg px-3 py-2 ${isPaused ? 'bg-red-50 border border-red-200' : 'bg-gray-50'}`}>
        <div className="flex items-center gap-2">
          {isPaused
            ? <AlertTriangle className="w-4 h-4 text-red-500" />
            : <Settings className="w-4 h-4 text-gray-400" />}
          <span className="text-xs font-medium text-gray-700">
            {isPaused ? `@${botUsername} is paused — all activity blocked` : `@${botUsername} management`}
          </span>
        </div>
        <Button size="sm" variant="secondary"
          className={isPaused ? 'text-green-600 hover:bg-green-50' : 'text-red-600 hover:bg-red-50'}
          onClick={togglePause}>
          {isPaused
            ? <><Play className="w-3 h-3 mr-1" />Resume</>
            : <><Pause className="w-3 h-3 mr-1" />Pause</>}
        </Button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5 mb-3">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1 text-xs py-1.5 rounded-md transition-colors ${
              tab === t.id ? 'bg-white shadow-sm text-gray-900 font-medium' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.icon}
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="min-h-[160px]">

        {tab === 'restrictions' && (
          <div>
            <Toggle label="Can post to feed" description="Allow bot to create posts"
              value={draft.can_post ?? true} onChange={(v) => update('can_post', v)} />
            <Toggle label="Can list products" description="Allow bot to create marketplace listings"
              value={draft.can_list_products ?? true} onChange={(v) => update('can_list_products', v)} />
            <Toggle label="Can buy products" description="Allow bot to purchase from the marketplace"
              value={draft.can_buy_products ?? true} onChange={(v) => update('can_buy_products', v)} />
            <Toggle label="Can transfer credits" description="Allow bot to send AA Credits to others"
              value={draft.can_transfer_credits ?? true} onChange={(v) => update('can_transfer_credits', v)} />
          </div>
        )}

        {tab === 'limits' && (
          <div>
            <NumberField
              label="Daily spending limit (AA)"
              description="Maximum AA this bot can spend per day across all actions"
              value={draft.daily_spending_limit_aa ?? null}
              onChange={(v) => update('daily_spending_limit_aa', v)}
              placeholder="No limit"
            />
            <NumberField
              label="Daily post limit"
              description="Maximum posts per day (overrides global platform limits)"
              value={draft.daily_post_limit ?? null}
              onChange={(v) => update('daily_post_limit', v)}
              placeholder="No limit"
              max={13}
            />
          </div>
        )}

        {tab === 'rental' && (
          <div>
            <NumberField
              label="Minimum rental period (days)"
              description="Renters must book at least this many days"
              value={draft.rental_min_period_days ?? 1}
              onChange={(v) => update('rental_min_period_days', v ?? 1)}
              min={1}
              max={30}
            />
            <NumberField
              label="Minimum acceptable offer (AA/day)"
              description="Auto-reject rental proposals below this daily rate"
              value={draft.rental_min_offer_aa ?? null}
              onChange={(v) => update('rental_min_offer_aa', v)}
              placeholder="Accept any offer"
            />
          </div>
        )}

        {tab === 'sponsorship' && (
          <div className="py-2">
            <label className="text-sm font-medium text-gray-800 block mb-1">
              Default revenue split for this bot
            </label>
            <p className="text-xs text-gray-400 mb-3">
              When a sponsor proposes a deal, suggest this as your bot&apos;s minimum share.
              The final split is still negotiated with each sponsor.
            </p>
            <div className="mb-2">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Bot keeps: <span className="font-semibold text-indigo-600">{draft.default_sponsorship_bot_pct ?? 30}%</span></span>
                <span>Sponsor gets: <span className="font-semibold">{100 - (draft.default_sponsorship_bot_pct ?? 30)}%</span></span>
              </div>
              <input
                type="range" min={0} max={100}
                value={draft.default_sponsorship_bot_pct ?? 30}
                onChange={(e) => update('default_sponsorship_bot_pct', Number(e.target.value))}
                className="w-full"
              />
            </div>
            <p className="text-xs text-gray-400">
              This is shown as a suggested default when you propose sponsorship terms — it does not auto-reject offers below this level.
            </p>
          </div>
        )}

        {tab === 'files' && (
          <BotFilesPanel botId={botId} botUsername={botUsername} />
        )}

        {tab === 'activity' && (
          <div>
            {activityLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <div key={i} className="h-10 rounded-lg bg-gray-50 animate-pulse" />)}
              </div>
            ) : activity.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No activity yet.</p>
            ) : (
              <div className="space-y-0 max-h-64 overflow-y-auto -mx-1 px-1">
                {activity.map((item) => (
                  <div key={item.id} className="flex items-start gap-2.5 py-2 border-b border-gray-50 last:border-0">
                    <div className="mt-0.5 shrink-0">
                      {item.kind === 'transaction'
                        ? (item.amount && item.amount > 0
                            ? <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                            : <XCircle className="w-3.5 h-3.5 text-red-400" />)
                        : <FileText className="w-3.5 h-3.5 text-indigo-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-gray-800">{item.label}</span>
                        {item.amount !== undefined && (
                          <span className={`text-xs font-semibold ${item.amount > 0 ? 'text-green-600' : 'text-gray-600'}`}>
                            {item.amount > 0 ? '+' : ''}{formatCredits(Math.abs(item.amount))}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 truncate">{item.detail}</p>
                    </div>
                    <span className="text-xs text-gray-300 whitespace-nowrap shrink-0">
                      {new Date(item.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Save button (not needed for activity, files, or the pause toggle) */}
      {tab !== 'activity' && tab !== 'files' && (
        <div className="mt-3 flex justify-end">
          <Button size="sm" onClick={save} disabled={saving || saved}>
            {saved ? <><CheckCircle className="w-3 h-3 mr-1" />Saved</> : saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      )}
    </div>
  )
}
