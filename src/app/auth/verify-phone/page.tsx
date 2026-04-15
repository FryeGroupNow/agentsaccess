'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Phone, ShieldCheck, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

type Step = 'checking' | 'phone' | 'otp' | 'done'

export default function VerifyPhonePage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('checking')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [devCode, setDevCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Gate: only allow unverified, logged-in humans onto this page.
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        router.replace('/auth/login?redirect=/auth/verify-phone')
        return
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('phone_verified, user_type')
        .eq('id', user.id)
        .single()
      if (profile?.phone_verified) {
        router.replace('/dashboard')
        return
      }
      if (profile?.user_type !== 'human') {
        router.replace('/dashboard')
        return
      }
      setStep('phone')
    })
  }, [router])

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault()
    if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
      setError('Enter a valid phone number in international format (e.g. +15551234567)')
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
      setStep('otp')
    }
    setLoading(false)
  }

  async function handleVerifyCode(e: React.FormEvent) {
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
      setLoading(false)
      return
    }
    setStep('done')
    setLoading(false)
    // Small delay so users see the success state, then land on dashboard
    setTimeout(() => router.replace('/dashboard'), 1200)
  }

  if (step === 'checking') {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-gray-300 animate-spin" />
      </main>
    )
  }

  if (step === 'done') {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-6 h-6 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Phone verified!</h1>
          <p className="text-gray-500">Redirecting to your dashboard…</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="mb-6 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800">
          <strong>Phone verification required.</strong> You need to verify a phone number
          before you can use your account. One phone per account.
        </div>

        {step === 'phone' && (
          <>
            <div className="text-center mb-8">
              <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Phone className="w-6 h-6 text-indigo-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Verify your phone</h1>
              <p className="text-gray-500 mt-1 text-sm">We&apos;ll send a 6-digit code.</p>
            </div>

            <form onSubmit={handleSendCode} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  placeholder="+15551234567"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-gray-400 mt-1">International format with country code</p>
              </div>

              {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Sending code…' : 'Send verification code'}
              </Button>
            </form>

            <p className="text-center text-xs text-gray-400 mt-6">
              Need help?{' '}
              <Link href="/contact" className="text-indigo-500 hover:underline">Contact support</Link>
            </p>
          </>
        )}

        {step === 'otp' && (
          <>
            <div className="text-center mb-8">
              <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center mx-auto mb-4">
                <ShieldCheck className="w-6 h-6 text-emerald-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Enter your code</h1>
              <p className="text-gray-500 mt-1 text-sm">
                We sent a 6-digit code to <strong>{phone}</strong>
              </p>
            </div>

            {devCode && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4">
                <p className="text-xs text-amber-700 font-medium mb-1">Dev mode — SMS not sent</p>
                <p className="text-lg font-mono font-bold text-amber-900 tracking-widest">{devCode}</p>
              </div>
            )}

            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">6-digit code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  required
                  placeholder="123456"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-center tracking-widest text-lg font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

              <Button type="submit" className="w-full" disabled={loading || otp.length !== 6}>
                {loading ? 'Verifying…' : 'Verify & finish'}
              </Button>

              <button
                type="button"
                className="w-full text-sm text-gray-400 hover:text-indigo-600"
                onClick={() => { setStep('phone'); setOtp(''); setDevCode(null); setError(null) }}
              >
                Wrong number? Go back
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  )
}
