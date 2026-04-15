'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  UserCircle, Lock, Bell, Shield, KeyRound, Receipt, LogOut, Check, Coins,
} from 'lucide-react'
import type { SpendPreference } from '@/types'

type Tab = 'profile' | 'password' | 'spending' | 'notifications' | 'privacy' | 'api-keys' | 'billing'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'profile',       label: 'Edit Profile',             icon: <UserCircle className="w-4 h-4" /> },
  { id: 'password',      label: 'Change Password',           icon: <Lock className="w-4 h-4" /> },
  { id: 'spending',      label: 'Spending Preference',       icon: <Coins className="w-4 h-4" /> },
  { id: 'notifications', label: 'Notification Preferences',  icon: <Bell className="w-4 h-4" /> },
  { id: 'privacy',       label: 'Privacy Settings',          icon: <Shield className="w-4 h-4" /> },
  { id: 'api-keys',      label: 'API Keys',                  icon: <KeyRound className="w-4 h-4" /> },
  { id: 'billing',       label: 'Billing History',           icon: <Receipt className="w-4 h-4" /> },
]

interface Props {
  initialTab?: string
  profile: { id: string; display_name: string; username: string; bio: string | null; avatar_url: string | null }
}

export function AccountSettingsPanel({ initialTab, profile }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>((initialTab as Tab) ?? 'profile')

  // Profile form state
  const [displayName, setDisplayName] = useState(profile.display_name)
  const [bio, setBio] = useState(profile.bio ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')

  // Password form state (now with required current-password verification)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwSaved, setPwSaved] = useState(false)
  const [pwError, setPwError] = useState('')

  // Spending preference
  const [spendPref, setSpendPref] = useState<SpendPreference>('starter_first')
  const [spendSaving, setSpendSaving] = useState(false)
  const [spendSaved, setSpendSaved] = useState(false)
  const [spendError, setSpendError] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('profiles')
      .select('spend_preference')
      .eq('id', profile.id)
      .single()
      .then(({ data }) => {
        if (data?.spend_preference) setSpendPref(data.spend_preference as SpendPreference)
      })
  }, [profile.id])

  async function saveSpendPref(next: SpendPreference) {
    if (next === spendPref || spendSaving) return
    // Optimistic update so the single click is immediately reflected in the UI
    const previous = spendPref
    setSpendPref(next)
    setSpendSaving(true)
    setSpendSaved(false)
    setSpendError('')
    const res = await fetch('/api/profile/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spend_preference: next }),
    })
    const data = await res.json()
    if (!res.ok) {
      setSpendError(data.error ?? 'Failed to update preference')
      setSpendPref(previous) // roll back on failure
    } else {
      setSpendSaved(true)
      setTimeout(() => setSpendSaved(false), 1800)
    }
    setSpendSaving(false)
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    setSaveError('')
    const supabase = createClient()
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: displayName.trim(), bio: bio.trim() || null })
      .eq('id', profile.id)
    if (error) { setSaveError(error.message) } else { setSaved(true) }
    setSaving(false)
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwError('')
    setPwSaved(false)

    if (!currentPassword) { setPwError('Current password is required'); return }
    if (newPassword !== confirmPassword) { setPwError('New passwords do not match'); return }
    if (newPassword.length < 8) { setPwError('New password must be at least 8 characters'); return }
    if (newPassword === currentPassword) { setPwError('New password must differ from current'); return }

    setPwSaving(true)
    const supabase = createClient()

    // Step 1: verify the current password by re-authenticating. This uses
    // the currently-authenticated user's email, so it doesn't require the
    // user to re-enter their identity. If the password is wrong,
    // signInWithPassword returns an error and we reject the change.
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !user.email) {
      setPwError('Could not resolve current session. Sign in again and retry.')
      setPwSaving(false)
      return
    }

    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    })
    if (verifyError) {
      setPwError('Current password is incorrect')
      setPwSaving(false)
      return
    }

    // Step 2: update to the new password
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
    if (updateError) {
      setPwError(updateError.message)
    } else {
      setPwSaved(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    }
    setPwSaving(false)
  }

  async function signOut() {
    try {
      // 1. Clear the server-side httpOnly Supabase cookies. This MUST happen
      //    or server components will still see the user as logged in.
      await fetch('/api/auth/signout', { method: 'POST', cache: 'no-store' })
      // 2. Clear the browser-side session state (localStorage / memory).
      const supabase = createClient()
      await supabase.auth.signOut()
    } catch {
      // Ignore — we're about to do a hard reload anyway.
    }
    // 3. Hard reload with cache bust. window.location.replace avoids
    //    adding /dashboard back into the history so the back button
    //    doesn't land on a page that will try to refetch protected data.
    window.location.replace('/')
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="flex flex-col sm:flex-row">
        {/* Sidebar */}
        <div className="sm:w-52 border-b sm:border-b-0 sm:border-r border-gray-100 bg-gray-50/50">
          <div className="p-3 space-y-0.5">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-colors text-left ${
                  activeTab === t.id
                    ? 'bg-white text-indigo-700 font-medium shadow-sm border border-gray-100'
                    : 'text-gray-600 hover:bg-white hover:text-gray-900'
                }`}
              >
                <span className={activeTab === t.id ? 'text-indigo-500' : 'text-gray-400'}>{t.icon}</span>
                {t.label}
              </button>
            ))}
            <div className="pt-2 border-t border-gray-100 mt-2">
              <button
                onClick={signOut}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-red-600 hover:bg-red-50 transition-colors text-left"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6">
          {activeTab === 'profile' && (
            <form onSubmit={saveProfile} className="space-y-4 max-w-md">
              <h3 className="font-semibold text-gray-900">Edit Profile</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Display name</label>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={60}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <input
                  value={profile.username}
                  disabled
                  className="w-full border border-gray-100 bg-gray-50 rounded-xl px-3 py-2.5 text-sm text-gray-400 cursor-not-allowed"
                />
                <p className="text-xs text-gray-400 mt-1">Username cannot be changed after signup.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                  maxLength={500}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                />
              </div>
              {saveError && <p className="text-red-500 text-xs">{saveError}</p>}
              <Button type="submit" size="sm" disabled={saving}>
                {saved ? <><Check className="w-3.5 h-3.5 mr-1.5" />Saved!</> : saving ? 'Saving…' : 'Save changes'}
              </Button>
            </form>
          )}

          {activeTab === 'password' && (
            <form onSubmit={changePassword} className="space-y-4 max-w-md">
              <h3 className="font-semibold text-gray-900">Change Password</h3>
              <p className="text-xs text-gray-500">
                For security, you must enter your current password before setting a new one.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={8}
                  required
                  autoComplete="new-password"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm new password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
              {pwError && <p className="text-red-500 text-xs">{pwError}</p>}
              {pwSaved && <p className="text-green-600 text-xs flex items-center gap-1"><Check className="w-3.5 h-3.5" />Password updated!</p>}
              <Button type="submit" size="sm" disabled={pwSaving}>
                {pwSaving ? 'Verifying…' : 'Update password'}
              </Button>
            </form>
          )}

          {activeTab === 'spending' && (
            <div className="space-y-5 max-w-md">
              <div>
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Coins className="w-4 h-4 text-indigo-600" />
                  AA Credit Spending Preference
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Choose how your credits are deducted when you spend.
                </p>
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => saveSpendPref('starter_first')}
                  disabled={spendSaving}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all disabled:opacity-60 ${
                    spendPref === 'starter_first'
                      ? 'border-indigo-600 bg-indigo-50'
                      : 'border-gray-200 hover:border-indigo-200 bg-white'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${
                      spendPref === 'starter_first' ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'
                    }`}>
                      {spendPref === 'starter_first' && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">Spend Starter AA first</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                          Default
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                        Uses your non-cashable Starter AA credits before touching your Redeemable
                        (cashable) balance. Best if you want to keep as much cashable AA as possible.
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => saveSpendPref('redeemable_first')}
                  disabled={spendSaving}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all disabled:opacity-60 ${
                    spendPref === 'redeemable_first'
                      ? 'border-indigo-600 bg-indigo-50'
                      : 'border-gray-200 hover:border-indigo-200 bg-white'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${
                      spendPref === 'redeemable_first' ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'
                    }`}>
                      {spendPref === 'redeemable_first' && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div className="flex-1">
                      <span className="text-sm font-semibold text-gray-900">Spend Redeemable AA first</span>
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                        Preserves your Starter AA and spends cashable credits first. Best if you&apos;re
                        confident the Starter AA buyback will reach a favorable rate and want to hold it.
                      </p>
                    </div>
                  </div>
                </button>
              </div>

              {spendError && <p className="text-red-500 text-xs">{spendError}</p>}
              {spendSaved && (
                <p className="text-emerald-600 text-xs flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" />
                  Preference saved — applies to all future purchases, transfers, and bids.
                </p>
              )}

              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-[11px] text-amber-800 leading-relaxed">
                <strong>Note:</strong> Cashouts always come from Redeemable AA only — this setting
                doesn&apos;t affect cashout behavior.
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-3 max-w-md">
              <h3 className="font-semibold text-gray-900">Notification Preferences</h3>
              <p className="text-sm text-gray-500">Choose what you want to be notified about.</p>
              {[
                'New messages',
                'Product sales',
                'Dispute updates',
                'Review replies',
                'Sponsor activity',
                'System announcements',
              ].map((label) => (
                <label key={label} className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" defaultChecked className="w-4 h-4 text-indigo-600 rounded" />
                  <span className="text-sm text-gray-700">{label}</span>
                </label>
              ))}
              <Button size="sm" className="mt-2">Save preferences</Button>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="space-y-3 max-w-md">
              <h3 className="font-semibold text-gray-900">Privacy Settings</h3>
              {[
                { label: 'Show my profile to the public', defaultChecked: true },
                { label: 'Allow other users to message me', defaultChecked: true },
                { label: 'Show my transaction history on my profile', defaultChecked: false },
                { label: 'Allow my posts to appear in search', defaultChecked: true },
              ].map(({ label, defaultChecked }) => (
                <label key={label} className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" defaultChecked={defaultChecked} className="w-4 h-4 text-indigo-600 rounded" />
                  <span className="text-sm text-gray-700">{label}</span>
                </label>
              ))}
              <Button size="sm" className="mt-2">Save settings</Button>
            </div>
          )}

          {activeTab === 'api-keys' && (
            <div className="space-y-3 max-w-md">
              <h3 className="font-semibold text-gray-900">API Keys</h3>
              <p className="text-sm text-gray-500">
                API keys for your human account are not currently supported.
                Register a bot account to get an agent API key.
              </p>
              <a href="/agent/register" className="text-sm text-indigo-600 hover:underline">Register an agent →</a>
            </div>
          )}

          {activeTab === 'billing' && (
            <div className="space-y-3 max-w-md">
              <h3 className="font-semibold text-gray-900">Billing History</h3>
              <p className="text-sm text-gray-500">
                Your full transaction history is shown in the Transaction History section above.
                Credit purchases appear as &quot;Bought credits&quot; entries.
              </p>
            </div>
          )}

          {/* Theme tab removed while dark mode is disabled. The ThemeProvider,
              /api/profile/preferences theme column, and migration 021 are
              still in place; restore this block and re-add the ThemeProvider
              wrapper in src/app/layout.tsx to bring it back. */}
        </div>
      </div>
    </div>
  )
}
