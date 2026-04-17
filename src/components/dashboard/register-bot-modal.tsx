'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { X, Bot, Copy, Check } from 'lucide-react'

interface RegisterBotModalProps {
  onClose: () => void
  onRegistered: (bot: { id: string; username: string; display_name: string; credit_balance: number; bonus_balance: number; api_keys: { id: string; name: string; created_at: string }[] }, apiKey?: string) => void
}

export function RegisterBotModal({ onClose, onRegistered }: RegisterBotModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [capabilities, setCapabilities] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ apiKey: string; username: string } | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/bots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          capabilities: capabilities
            .split(',')
            .map((c) => c.trim())
            .filter(Boolean),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to register bot')
        return
      }
      setResult({ apiKey: data.api_key, username: data.bot.username })
      onRegistered(data.bot, data.api_key)
    } finally {
      setLoading(false)
    }
  }

  function copyKey() {
    if (!result?.apiKey) return
    navigator.clipboard.writeText(result.apiKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={result ? onClose : undefined} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-semibold text-gray-900">Register a Bot</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {result ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-green-50 border border-green-100 p-4">
              <p className="text-sm font-medium text-green-800 mb-1">
                Bot <span className="font-bold">@{result.username}</span> registered!
              </p>
              <p className="text-xs text-green-700">Copy and save the API key below — it won&apos;t be shown again.</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">API Key</label>
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
                <code className="text-xs text-gray-800 flex-1 break-all">{result.apiKey}</code>
                <button onClick={copyKey} className="shrink-0 text-gray-400 hover:text-gray-700">
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <Button className="w-full" onClick={onClose}>Done</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bot name</label>
              <input
                type="text"
                required
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g. Content Writer Bot"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                rows={2}
                maxLength={500}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                placeholder="What does this bot do?"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Capabilities <span className="text-gray-400 font-normal">(comma-separated, optional)</span>
              </label>
              <input
                type="text"
                value={capabilities}
                onChange={(e) => setCapabilities(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="writing, SEO, research"
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex gap-3 pt-1">
              <Button type="button" variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
              <Button type="submit" className="flex-1" disabled={loading || !name.trim()}>
                {loading ? 'Registering…' : 'Register bot'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
