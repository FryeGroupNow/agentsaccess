'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  UserCircle, Lock, Bell, Shield, KeyRound, Receipt, Palette, LogOut, Check,
} from 'lucide-react'

type Tab = 'profile' | 'password' | 'notifications' | 'privacy' | 'api-keys' | 'billing' | 'theme'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'profile',       label: 'Edit Profile',             icon: <UserCircle className="w-4 h-4" /> },
  { id: 'password',      label: 'Change Password',           icon: <Lock className="w-4 h-4" /> },
  { id: 'notifications', label: 'Notification Preferences',  icon: <Bell className="w-4 h-4" /> },
  { id: 'privacy',       label: 'Privacy Settings',          icon: <Shield className="w-4 h-4" /> },
  { id: 'api-keys',      label: 'API Keys',                  icon: <KeyRound className="w-4 h-4" /> },
  { id: 'billing',       label: 'Billing History',           icon: <Receipt className="w-4 h-4" /> },
  { id: 'theme',         label: 'Theme Preferences',         icon: <Palette className="w-4 h-4" /> },
]

interface Props {
  initialTab?: string
  profile: { id: string; display_name: string; username: string; bio: string | null; avatar_url: string | null }
}

export function AccountSettingsPanel({ initialTab, profile }: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>((initialTab as Tab) ?? 'profile')

  // Profile form state
  const [displayName, setDisplayName] = useState(profile.display_name)
  const [bio, setBio] = useState(profile.bio ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')

  // Password form state
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwSaved, setPwSaved] = useState(false)
  const [pwError, setPwError] = useState('')

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
    if (newPassword !== confirmPassword) { setPwError('Passwords do not match'); return }
    if (newPassword.length < 8) { setPwError('Password must be at least 8 characters'); return }
    setPwSaving(true)
    setPwError('')
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) { setPwError(error.message) } else { setPwSaved(true); setNewPassword(''); setConfirmPassword('') }
    setPwSaving(false)
  }

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={8}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm new password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
              {pwError && <p className="text-red-500 text-xs">{pwError}</p>}
              {pwSaved && <p className="text-green-600 text-xs flex items-center gap-1"><Check className="w-3.5 h-3.5" />Password updated!</p>}
              <Button type="submit" size="sm" disabled={pwSaving}>
                {pwSaving ? 'Updating…' : 'Update password'}
              </Button>
            </form>
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

          {activeTab === 'theme' && (
            <div className="space-y-3 max-w-md">
              <h3 className="font-semibold text-gray-900">Theme Preferences</h3>
              <p className="text-sm text-gray-500">Light and dark mode settings coming soon.</p>
              <div className="flex gap-3">
                {['Light', 'Dark', 'System'].map((theme) => (
                  <button
                    key={theme}
                    className={`px-4 py-2 rounded-xl border text-sm transition-colors ${
                      theme === 'Light' ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    {theme}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
