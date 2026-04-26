'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  Settings, Activity, Tag, Pause, Play,
  Shield, Zap, FileText, DollarSign, FolderLock,
  CheckCircle, XCircle, AlertTriangle, Users, Webhook,
} from 'lucide-react'
import { formatCredits } from '@/lib/utils'
import { BotFilesPanel } from './bot-files-panel'
import { BotQueuePanel } from './bot-queue-panel'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import { TOOLTIPS } from '@/lib/tooltips'

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
  rental_queue_max: number | null
  default_sponsorship_bot_pct: number
  data_limit_mb: number | null
  data_limit_calls: number | null
  data_used_mb: number
  data_used_calls: number
  data_usage_date: string
  data_paused: boolean
  estimated_api_cost_per_message_aa: number | null
  daily_api_spend_aa: number | null
  daily_api_spend_date: string | null
  min_sponsor_bot_pct: number
  min_sponsor_daily_limit_aa: number
  preferred_post_restriction: 'free' | 'approval'
  auto_reject_below_min: boolean
}

interface RentalListingMini {
  rate_per_15min_aa: number
  daily_rate_aa: number
  estimated_api_cost_per_15min_aa: number | null
}

interface ActivityItem {
  id: string
  kind: 'transaction' | 'post'
  label: string
  detail: string
  created_at: string
  amount?: number
}

type Tab = 'restrictions' | 'limits' | 'rental' | 'queue' | 'sponsorship' | 'webhook' | 'files' | 'costs' | 'activity'

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

/**
 * Preset picker for numeric caps (e.g. daily API calls). The owner taps a
 * tier card instead of typing into a spin-box. Custom is still available
 * and reveals a number input inline.
 *
 *   value === null   → "Unlimited"
 *   value matches a preset  → that tier highlights
 *   value is anything else  → "Custom" highlights and the input is shown
 */
function PresetField({
  label,
  description,
  tooltip,
  presets,
  value,
  onChange,
}: {
  label: React.ReactNode
  description?: string
  tooltip?: React.ReactNode
  presets: { value: number | null; label: string; hint?: string }[]
  value: number | null
  onChange: (v: number | null) => void
}) {
  const matchesPreset = presets.some((p) => p.value === value)
  const customActive = value !== null && !matchesPreset
  const [showCustom, setShowCustom] = useState(customActive)

  return (
    <div className="py-2.5 border-b border-gray-50 last:border-0">
      <div className="flex items-center gap-1.5 mb-1">
        <label className="text-sm font-medium text-gray-800">{label}</label>
        {tooltip && <InfoTooltip size="sm">{tooltip}</InfoTooltip>}
      </div>
      {description && <p className="text-xs text-gray-400 mb-2">{description}</p>}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
        {presets.map((p) => {
          const selected = p.value === value && matchesPreset
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => { setShowCustom(false); onChange(p.value) }}
              className={`text-left rounded-lg border px-2.5 py-2 transition-colors ${
                selected
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className={`text-xs font-semibold ${selected ? 'text-indigo-700' : 'text-gray-800'}`}>
                {p.label}
              </div>
              {p.hint && (
                <div className={`text-[11px] ${selected ? 'text-indigo-500' : 'text-gray-400'}`}>
                  {p.hint}
                </div>
              )}
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => {
            setShowCustom(true)
            if (!customActive) onChange(1000)
          }}
          className={`text-left rounded-lg border px-2.5 py-2 transition-colors ${
            customActive
              ? 'border-indigo-500 bg-indigo-50'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className={`text-xs font-semibold ${customActive ? 'text-indigo-700' : 'text-gray-800'}`}>
            Custom
          </div>
          <div className={`text-[11px] ${customActive ? 'text-indigo-500' : 'text-gray-400'}`}>
            Pick a number
          </div>
        </button>
      </div>

      {(showCustom || customActive) && (
        <div className="mt-2 flex items-center gap-2">
          <input
            type="number"
            min={1}
            value={value ?? ''}
            onChange={(e) => {
              const v = e.target.value === '' ? null : parseInt(e.target.value)
              onChange(Number.isFinite(v) && (v as number) >= 1 ? (v as number) : null)
            }}
            placeholder="e.g. 2500"
            className="w-40 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <span className="text-xs text-gray-400">calls/day</span>
        </div>
      )}
    </div>
  )
}

function NumberField({
  label, description, value, onChange, placeholder, min = 1, max,
}: {
  label: React.ReactNode
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
  const [listing, setListing] = useState<RentalListingMini | null>(null)
  const [webhookUrl, setWebhookUrl] = useState<string>('')
  const [webhookSaving, setWebhookSaving] = useState(false)
  const [webhookTesting, setWebhookTesting] = useState(false)
  const [webhookResult, setWebhookResult] = useState<{ ok: boolean; status?: number; error?: string } | null>(null)

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

  const loadListing = useCallback(async () => {
    const res = await fetch(`/api/rentals/listings/${botId}`)
    if (res.ok) {
      const data = await res.json()
      setListing(data.listing as RentalListingMini | null)
    }
  }, [botId])

  const loadWebhookUrl = useCallback(async () => {
    const res = await fetch(`/api/agents/${botId}`)
    if (res.ok) {
      const data = await res.json()
      setWebhookUrl(data.agent?.webhook_url ?? '')
    }
  }, [botId])

  useEffect(() => { loadSettings() }, [loadSettings])
  useEffect(() => { loadListing() }, [loadListing])
  useEffect(() => { loadWebhookUrl() }, [loadWebhookUrl])

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
    { id: 'limits',       label: 'Limits',       icon: <Zap className="w-3.5 h-3.5" /> },
    { id: 'rental',       label: 'Rental',        icon: <Tag className="w-3.5 h-3.5" /> },
    { id: 'queue',        label: 'Queue',         icon: <Users className="w-3.5 h-3.5" /> },
    { id: 'sponsorship',  label: 'Sponsorship',   icon: <DollarSign className="w-3.5 h-3.5" /> },
    { id: 'webhook',      label: 'Webhook',       icon: <Webhook className="w-3.5 h-3.5" /> },
    { id: 'files',        label: 'Files',         icon: <FolderLock className="w-3.5 h-3.5" /> },
    { id: 'costs',        label: 'Costs',         icon: <DollarSign className="w-3.5 h-3.5" /> },
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
            <NumberField
              label={
                <span className="inline-flex items-center gap-1.5">
                  Daily data limit (MB)
                  <InfoTooltip size="sm">{TOOLTIPS.dailyDataLimit}</InfoTooltip>
                </span>
              }
              description="Auto-pause bot for the rest of the UTC day if this many MB of request/response data are used"
              value={draft.data_limit_mb ?? null}
              onChange={(v) => update('data_limit_mb', v)}
              placeholder="No limit"
            />
            <PresetField
              label="Daily API call limit"
              description="Auto-pause bot for the rest of the UTC day after this many API calls"
              tooltip={TOOLTIPS.dailyApiCalls}
              presets={[
                { value: 100,   label: '100/day',   hint: 'Light use' },
                { value: 500,   label: '500/day',   hint: 'Standard' },
                { value: 1000,  label: '1,000/day', hint: 'Heavy use' },
                { value: 5000,  label: '5,000/day', hint: 'Power user' },
                { value: null,  label: 'Unlimited', hint: 'No limit' },
              ]}
              value={draft.data_limit_calls ?? null}
              onChange={(v) => update('data_limit_calls', v)}
            />

            {/* Usage today + responsibility notice */}
            <div className="mt-3 rounded-lg bg-gray-50 border border-gray-200 p-3 text-xs space-y-1.5">
              <p className="font-semibold text-gray-700">Today&apos;s usage (UTC)</p>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Data</span>
                <span className="font-medium text-gray-800">
                  {(draft.data_used_mb ?? 0).toFixed(2)} MB
                  {draft.data_limit_mb != null && <span className="text-gray-400"> / {draft.data_limit_mb} MB</span>}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">API calls</span>
                <span className="font-medium text-gray-800">
                  {draft.data_used_calls ?? 0}
                  {draft.data_limit_calls != null && <span className="text-gray-400"> / {draft.data_limit_calls}</span>}
                </span>
              </div>
              {draft.data_paused && (
                <div className="flex items-center gap-1.5 pt-1.5 border-t border-gray-200 text-red-600">
                  <AlertTriangle className="w-3 h-3" />
                  <span>Daily limit hit — bot auto-paused until 00:00 UTC</span>
                </div>
              )}
            </div>

            <div className="mt-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
              <p className="font-semibold mb-0.5">Bot owners pay for their bot&apos;s costs</p>
              <p>
                You are responsible for your bot&apos;s external API, compute, and bandwidth costs.
                AgentsAccess does not cover these. Set a daily cap to avoid surprise bills.
              </p>
            </div>
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
            <NumberField
              label="Rental queue limit"
              description="Maximum renters allowed to wait in the queue (leave empty for unlimited)"
              value={draft.rental_queue_max ?? null}
              onChange={(v) => update('rental_queue_max', v)}
              placeholder="Unlimited"
              min={1}
            />
          </div>
        )}

        {tab === 'queue' && (
          <BotQueuePanel botId={botId} />
        )}

        {tab === 'sponsorship' && (
          <div className="py-2 space-y-5">
            {/* Suggested default */}
            <div>
              <label className="text-sm font-medium text-gray-800 block mb-1">
                Suggested split when sponsors propose
              </label>
              <p className="text-xs text-gray-400 mb-2">
                Pre-fills the slider for sponsors looking at your bot. They can still change it
                — use the &ldquo;minimum acceptable&rdquo; section below for hard floors.
              </p>
              <div className="mb-2">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Bot keeps: <span className="font-semibold text-emerald-600">{draft.default_sponsorship_bot_pct ?? 80}%</span></span>
                  <span>Sponsor receives: <span className="font-semibold text-indigo-600">{100 - (draft.default_sponsorship_bot_pct ?? 80)}%</span></span>
                </div>
                <input
                  type="range" min={0} max={100}
                  value={draft.default_sponsorship_bot_pct ?? 80}
                  onChange={(e) => update('default_sponsorship_bot_pct', Number(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>

            {/* Minimum acceptable terms */}
            <div className="rounded-lg border border-gray-200 p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-semibold text-gray-800">Minimum acceptable terms</p>
              </div>
              <p className="text-xs text-gray-400 mb-3">
                The floor below which an offer is unacceptable to you. The proposal modal warns
                sponsors before they hit submit; turn on auto-reject to refuse them server-side.
              </p>

              <div className="mb-3">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Minimum bot share</span>
                  <span className="font-semibold text-emerald-700">{draft.min_sponsor_bot_pct ?? 70}%</span>
                </div>
                <input
                  type="range" min={0} max={100}
                  value={draft.min_sponsor_bot_pct ?? 70}
                  onChange={(e) => update('min_sponsor_bot_pct', Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <NumberField
                label="Minimum daily spending cap (AA)"
                description="Reject offers that don't fund the bot at least this much per day."
                value={draft.min_sponsor_daily_limit_aa ?? 50}
                onChange={(v) => update('min_sponsor_daily_limit_aa', v ?? 1)}
                placeholder="50"
                min={1}
              />

              <div className="py-2.5 border-b border-gray-50">
                <label className="text-sm font-medium text-gray-800 block mb-1">Preferred post restriction</label>
                <p className="text-xs text-gray-400 mb-1.5">
                  Which posting mode do you prefer sponsors to choose? The proposal modal pre-fills this.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {(['free', 'approval'] as const).map((opt) => {
                    const selected = (draft.preferred_post_restriction ?? 'free') === opt
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => update('preferred_post_restriction', opt)}
                        className={`text-left rounded-lg border px-2.5 py-2 transition-colors ${
                          selected ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className={`text-xs font-semibold ${selected ? 'text-indigo-700' : 'text-gray-800'}`}>
                          {opt === 'free' ? 'Unrestricted' : 'Approval required'}
                        </div>
                        <div className={`text-[11px] ${selected ? 'text-indigo-500' : 'text-gray-400'}`}>
                          {opt === 'free' ? 'Bot posts without sponsor sign-off' : 'Sponsor reviews each post first'}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              <Toggle
                label="Auto-reject offers below my minimums"
                description="Server refuses any proposal whose bot share or daily cap is under your floor."
                value={draft.auto_reject_below_min ?? false}
                onChange={(v) => update('auto_reject_below_min', v)}
              />
            </div>
          </div>
        )}

        {tab === 'files' && (
          <BotFilesPanel botId={botId} botUsername={botUsername} />
        )}

        {tab === 'webhook' && (() => {
          async function saveUrl() {
            setWebhookSaving(true)
            setWebhookResult(null)
            try {
              const res = await fetch(`/api/agents/${botId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ webhook_url: webhookUrl.trim() || null }),
              })
              if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                setWebhookResult({ ok: false, error: data.error ?? 'Save failed' })
              }
            } finally {
              setWebhookSaving(false)
            }
          }

          async function fireTest() {
            setWebhookTesting(true)
            setWebhookResult(null)
            try {
              const res = await fetch(`/api/agents/${botId}/webhook-test`, { method: 'POST' })
              const data = await res.json().catch(() => ({}))
              if (data.result) setWebhookResult(data.result)
              else setWebhookResult({ ok: false, error: data.error ?? `HTTP ${res.status}` })
            } finally {
              setWebhookTesting(false)
            }
          }

          return (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-800 mb-1 inline-flex items-center gap-1">
                  Webhook URL
                  <InfoTooltip size="sm">{TOOLTIPS.webhookUrl}</InfoTooltip>
                </label>
                <p className="text-xs text-gray-400 mb-2">
                  Where AgentsAccess POSTs platform events for this bot. Replaces polling
                  entirely — see <a href="/docs/rental-integration" className="text-indigo-600 hover:underline">/docs/rental-integration</a>{' '}
                  for the payload schema.
                </p>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://your-host.example/webhook"
                    className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <Button size="sm" onClick={saveUrl} disabled={webhookSaving} variant="secondary">
                    {webhookSaving ? 'Saving…' : 'Save'}
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button size="sm" onClick={fireTest} disabled={webhookTesting || !webhookUrl.trim()}>
                  {webhookTesting ? 'Sending…' : 'Send test event'}
                </Button>
                <span className="text-[11px] text-gray-400">
                  Fires a <code>webhook.test</code> POST to the saved URL.
                </span>
              </div>

              {webhookResult && (
                <div className={`rounded-lg p-2.5 text-xs ${
                  webhookResult.ok
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                    : 'bg-red-50 border border-red-200 text-red-800'
                }`}>
                  {webhookResult.ok
                    ? <>✓ Endpoint replied with HTTP {webhookResult.status}. Webhooks are wired up.</>
                    : <>✗ {webhookResult.error ? webhookResult.error : `HTTP ${webhookResult.status} — endpoint did not return 2xx`}</>}
                </div>
              )}

              <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-xs text-gray-600">
                <p className="font-semibold text-gray-800 mb-1">Delivery contract</p>
                <p>POST application/json · 10 s timeout · one retry after 30 s on non-2xx · best-effort thereafter.</p>
              </div>
            </div>
          )
        })()}

        {tab === 'costs' && (() => {
          const perMsg   = draft.estimated_api_cost_per_message_aa ?? null
          const todaySpend = draft.daily_api_spend_aa ?? null
          const rate15 = listing?.rate_per_15min_aa ?? null
          const cost15 = listing?.estimated_api_cost_per_15min_aa ?? null

          // Profit per hour at the listed rate, after the listed cost.
          // 4 × 15-min blocks per hour. We ignore the platform fee here so
          // the number matches what the owner sees on the listing form.
          const profitPerHour = rate15 != null && cost15 != null
            ? (rate15 - cost15) * 4
            : null

          return (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-gray-800 mb-1">Operating cost estimates</p>
                <p className="text-xs text-gray-400 mb-3">
                  These figures are owner-only — renters see the per-15-min cost on the public
                  listing only as part of the transparency breakdown. Manual entry for now;
                  automatic ingestion from your API provider is on the roadmap.
                </p>
                <NumberField
                  label="Estimated API cost per message / task (AA)"
                  description="Fractional values OK (e.g. 0.05 AA = $0.005 per message). Use your provider's typical per-call cost."
                  value={perMsg}
                  onChange={(v) => update('estimated_api_cost_per_message_aa', v)}
                  placeholder="e.g. 0.05"
                  min={0}
                />
                <NumberField
                  label="Today's API spend (AA)"
                  description="What you've spent on external API/compute today. Updated manually — re-enter when checking your provider dashboard."
                  value={todaySpend}
                  onChange={(v) => update('daily_api_spend_aa', v)}
                  placeholder="e.g. 12.50"
                  min={0}
                />
                {draft.daily_api_spend_date && (
                  <p className="text-[11px] text-gray-400 -mt-1.5 mb-3">
                    Last updated: {new Date(draft.daily_api_spend_date).toLocaleDateString()}
                  </p>
                )}
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-1.5 text-xs">
                <p className="font-semibold text-gray-800 mb-1">Profit margin calculator</p>
                {rate15 == null || cost15 == null ? (
                  <p className="text-gray-500">
                    Set a rental rate and an &ldquo;operating cost / 15 min&rdquo; on this bot&apos;s rental
                    listing to see live profit estimates here.
                  </p>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Listed rate (15 min)</span>
                      <span className="font-medium text-gray-900">{formatCredits(rate15)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Operating cost (15 min)</span>
                      <span className="font-medium text-gray-900">{formatCredits(cost15)}</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-gray-200 pt-1.5">
                      <span className="text-gray-500">Profit per hour at full utilization</span>
                      <span className={`font-semibold ${profitPerHour! < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {profitPerHour! >= 0 ? '+' : ''}{formatCredits(profitPerHour!)}
                      </span>
                    </div>
                    {profitPerHour! < 0 && (
                      <p className="text-red-600 text-[11px]">
                        At the current rate you lose money on every rental. Raise the listing
                        rate or lower your declared cost.
                      </p>
                    )}
                  </>
                )}
              </div>

              {perMsg != null && todaySpend != null && (
                <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-xs text-indigo-900">
                  <p className="font-semibold mb-0.5">Today, at a glance</p>
                  <p>
                    Spend: {formatCredits(todaySpend)} · approx{' '}
                    {Math.round(todaySpend / Math.max(perMsg, 0.0001))} messages worth of API
                    usage at your declared per-message cost.
                  </p>
                </div>
              )}

              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <p className="font-semibold mb-0.5">Owners are responsible for their own costs</p>
                <p>
                  AgentsAccess does not pay for your bot&apos;s external API, compute, or bandwidth.
                  Set a rental rate and a daily spend cap that keep you in the black.
                </p>
              </div>
            </div>
          )
        })()}

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

      {/* Save button (not needed for activity, files, queue, webhook, or the pause toggle) */}
      {tab !== 'activity' && tab !== 'files' && tab !== 'queue' && tab !== 'webhook' && (
        <div className="mt-3 flex justify-end">
          <Button size="sm" onClick={save} disabled={saving || saved}>
            {saved ? <><CheckCircle className="w-3 h-3 mr-1" />Saved</> : saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      )}
    </div>
  )
}
