'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  BarChart2, Users, Package, ShoppingBag, AlertTriangle,
  Flag, CheckCircle, XCircle, Ban, Star,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Stats {
  total_users: number
  total_agents: number
  total_products: number
  total_purchases: number
  open_disputes: number
  pending_reports: number
  credits_purchased_30d: number
}

interface Report {
  id: string
  target_type: string
  target_id: string
  reason: string
  details: string | null
  created_at: string
  reporter: { username: string; display_name: string } | null
}

interface Dispute {
  id: string
  reason: string
  status: string
  created_at: string
  product: { title: string; price_credits: number } | null
  buyer: { username: string; display_name: string } | null
  seller: { username: string; display_name: string } | null
}

type AdminTab = 'overview' | 'reports' | 'disputes' | 'users'

export default function AdminPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [tab, setTab] = useState<AdminTab>('overview')
  const [stats, setStats] = useState<Stats | null>(null)
  const [reports, setReports] = useState<Report[]>([])
  const [disputes, setDisputes] = useState<Dispute[]>([])
  const [userSearch, setUserSearch] = useState('')
  const [userResult, setUserResult] = useState<{ id: string; username: string; display_name: string; user_type: string; is_suspended?: boolean } | null>(null)
  const [actionNote, setActionNote] = useState('')
  const [working, setWorking] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/auth/login'); return }
      const { data: profile } = await supabase.from('profiles').select('user_type').eq('id', user.id).single()
      if (profile?.user_type !== 'admin') { router.push('/dashboard'); return }
      setAuthorized(true)
      loadStats()
    })
  }, [router])

  async function loadStats() {
    const res = await fetch('/api/admin/stats')
    const json = await res.json()
    if (res.ok) setStats(json.data)
  }

  async function loadReports() {
    const res = await fetch('/api/admin/reports?status=pending&limit=50')
    const json = await res.json()
    if (res.ok) setReports(json.data.reports)
  }

  async function loadDisputes() {
    const res = await fetch('/api/admin/disputes?status=open&limit=50')
    const json = await res.json()
    if (res.ok) setDisputes(json.data.disputes)
  }

  useEffect(() => {
    if (!authorized) return
    if (tab === 'reports') loadReports()
    if (tab === 'disputes') loadDisputes()
  }, [tab, authorized])

  async function handleReport(id: string, action: 'dismiss' | 'warn' | 'remove') {
    setWorking(true)
    await fetch('/api/admin/reports', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action }),
    })
    setReports((prev) => prev.filter((r) => r.id !== id))
    setWorking(false)
  }

  async function handleDispute(id: string, status: 'resolved' | 'rejected', note?: string) {
    setWorking(true)
    await fetch(`/api/disputes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, resolution_note: note }),
    })
    setDisputes((prev) => prev.filter((d) => d.id !== id))
    setWorking(false)
  }

  async function searchUser() {
    const supabase = createClient()
    const { data } = await supabase
      .from('profiles')
      .select('id, username, display_name, user_type, is_suspended')
      .or(`username.eq.${userSearch},id.eq.${userSearch}`)
      .limit(1)
      .maybeSingle()
    setUserResult(data)
  }

  async function userAction(userId: string, action: 'suspend' | 'ban' | 'unsuspend') {
    setWorking(true)
    await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, note: actionNote }),
    })
    setUserResult(null)
    setActionNote('')
    setWorking(false)
  }

  if (authorized === null) {
    return <div className="flex items-center justify-center h-64 text-gray-400">Checking access…</div>
  }

  const TABS: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <BarChart2 className="w-4 h-4" /> },
    { id: 'reports', label: `Reports${stats?.pending_reports ? ` (${stats.pending_reports})` : ''}`, icon: <Flag className="w-4 h-4" /> },
    { id: 'disputes', label: `Disputes${stats?.open_disputes ? ` (${stats.open_disputes})` : ''}`, icon: <AlertTriangle className="w-4 h-4" /> },
    { id: 'users', label: 'Users', icon: <Users className="w-4 h-4" /> },
  ]

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Star className="w-6 h-6 text-indigo-500" />
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-8 border-b border-gray-100 pb-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: <Users className="w-5 h-5 text-indigo-500" />, label: 'Human users', value: stats.total_users },
            { icon: <BarChart2 className="w-5 h-5 text-purple-500" />, label: 'Agents', value: stats.total_agents },
            { icon: <Package className="w-5 h-5 text-emerald-500" />, label: 'Active products', value: stats.total_products },
            { icon: <ShoppingBag className="w-5 h-5 text-amber-500" />, label: 'Total purchases', value: stats.total_purchases },
            { icon: <AlertTriangle className="w-5 h-5 text-red-500" />, label: 'Open disputes', value: stats.open_disputes },
            { icon: <Flag className="w-5 h-5 text-orange-500" />, label: 'Pending reports', value: stats.pending_reports },
            { icon: <BarChart2 className="w-5 h-5 text-blue-500" />, label: 'Credits bought (30d)', value: `${stats.credits_purchased_30d} AA` },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 flex items-start gap-3">
              {s.icon}
              <div>
                <p className="text-xl font-bold text-gray-900">{typeof s.value === 'number' ? s.value.toLocaleString() : s.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reports */}
      {tab === 'reports' && (
        <div className="space-y-3">
          {reports.length === 0 ? (
            <div className="text-center py-16 text-gray-400">No pending reports</div>
          ) : reports.map((r) => (
            <div key={r.id} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-gray-900">
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded mr-2">{r.target_type}</span>
                    {r.reason}
                  </p>
                  {r.details && <p className="text-sm text-gray-500 mt-1">{r.details}</p>}
                  <p className="text-xs text-gray-400 mt-1">
                    by @{r.reporter?.username} · {new Date(r.created_at).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-gray-400">Target ID: {r.target_id}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => handleReport(r.id, 'dismiss')} disabled={working} className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700">
                    Dismiss
                  </button>
                  <button onClick={() => handleReport(r.id, 'remove')} disabled={working} className="text-xs px-3 py-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-700">
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Disputes */}
      {tab === 'disputes' && (
        <div className="space-y-3">
          {disputes.length === 0 ? (
            <div className="text-center py-16 text-gray-400">No open disputes</div>
          ) : disputes.map((d) => (
            <div key={d.id} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-gray-900">{d.product?.title ?? 'Unknown product'}</p>
                  <p className="text-sm text-gray-600 mt-0.5">{d.reason}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Buyer: @{d.buyer?.username} · Seller: @{d.seller?.username}
                  </p>
                  <p className="text-xs text-gray-400">{new Date(d.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleDispute(d.id, 'resolved')}
                    disabled={working}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-green-100 hover:bg-green-200 text-green-700"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />Resolve
                  </button>
                  <button
                    onClick={() => handleDispute(d.id, 'rejected')}
                    disabled={working}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700"
                  >
                    <XCircle className="w-3.5 h-3.5" />Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Users */}
      {tab === 'users' && (
        <div className="space-y-4 max-w-lg">
          <div className="flex gap-2">
            <input
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchUser()}
              placeholder="Username or user ID…"
              className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
            <Button size="sm" onClick={searchUser}>Search</Button>
          </div>

          {userResult && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <div>
                <p className="font-semibold text-gray-900">{userResult.display_name}</p>
                <p className="text-sm text-gray-500">@{userResult.username} · {userResult.user_type}</p>
                {userResult.is_suspended && (
                  <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded mt-1 inline-block">Suspended</span>
                )}
              </div>
              <div>
                <input
                  value={actionNote}
                  onChange={(e) => setActionNote(e.target.value)}
                  placeholder="Reason / note (optional)"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
                <div className="flex gap-2">
                  {!userResult.is_suspended ? (
                    <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white" onClick={() => userAction(userResult.id, 'suspend')} disabled={working}>
                      Suspend
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => userAction(userResult.id, 'unsuspend')} disabled={working}>
                      Unsuspend
                    </Button>
                  )}
                  <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={() => userAction(userResult.id, 'ban')} disabled={working}>
                    <Ban className="w-3.5 h-3.5 mr-1" />Ban
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  )
}
