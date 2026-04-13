'use client'

import { useState } from 'react'
import { Phone, ShieldCheck, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PhoneVerifyBannerProps {
  className?: string
}

export function PhoneVerifyBanner({ className = '' }: PhoneVerifyBannerProps) {
  const [dismissed, setDismissed] = useState(false)
  const [phase, setPhase] = useState<'prompt' | 'phone' | 'otp' | 'done'>('prompt')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [devCode, setDevCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (dismissed) return null
  if (phase === 'done') {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex items-center gap-2 text-sm text-emerald-700">
        <ShieldCheck className="w-4 h-4" />
        Phone verified successfully.
      </div>
    )
  }

  async function sendCode(e: React.FormEvent) {
    e.preventDefault()
    if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
      setError('Use international format: +15551234567')
      return
    }
    setError(null)
    setLoading(true)
    const res = await fetch('/api/phone/send-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Failed to send code')
    } else {
      if (data.dev_code) setDevCode(data.dev_code)
      setPhase('otp')
    }
    setLoading(false)
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const res = await fetch('/api/phone/verify-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code: otp }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Invalid code')
    } else {
      setPhase('done')
    }
    setLoading(false)
  }

  return (
    <div className={`rounded-xl border border-amber-200 bg-amber-50 p-4 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <Phone className="w-4 h-4 text-amber-600" />
          <span className="text-sm font-semibold text-amber-900">Verify your phone number</span>
        </div>
        {phase === 'prompt' && (
          <button onClick={() => setDismissed(true)} className="text-amber-400 hover:text-amber-600">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {phase === 'prompt' && (
        <div className="mt-2 flex items-center gap-3 flex-wrap">
          <p className="text-sm text-amber-700 flex-1">
            Add a phone number to protect your account against duplicate signups and fraud.
          </p>
          <Button size="sm" onClick={() => setPhase('phone')} className="bg-amber-600 hover:bg-amber-700 shrink-0">
            Add phone
          </Button>
        </div>
      )}

      {phase === 'phone' && (
        <form onSubmit={sendCode} className="mt-3 flex gap-2 flex-wrap">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+15551234567"
            required
            className="flex-1 min-w-0 px-3 py-1.5 border border-amber-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <Button type="submit" size="sm" disabled={loading} className="bg-amber-600 hover:bg-amber-700 shrink-0">
            {loading ? 'Sending…' : 'Send code'}
          </Button>
          {error && <p className="w-full text-xs text-red-600">{error}</p>}
        </form>
      )}

      {phase === 'otp' && (
        <form onSubmit={verifyCode} className="mt-3 space-y-2">
          <p className="text-xs text-amber-700">Code sent to {phone}</p>
          {devCode && (
            <div className="bg-white border border-amber-200 rounded px-3 py-1.5 text-xs text-amber-800">
              Dev mode — code: <span className="font-mono font-bold">{devCode}</span>
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
              required
              className="w-32 px-3 py-1.5 border border-amber-200 rounded-lg text-sm font-mono text-center bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <Button type="submit" size="sm" disabled={loading || otp.length !== 6} className="bg-amber-600 hover:bg-amber-700">
              {loading ? 'Verifying…' : 'Verify'}
            </Button>
            <button
              type="button"
              className="text-xs text-amber-500 hover:text-amber-700"
              onClick={() => { setPhase('phone'); setOtp(''); setDevCode(null); setError(null) }}
            >
              Wrong number?
            </button>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </form>
      )}

    </div>
  )
}
