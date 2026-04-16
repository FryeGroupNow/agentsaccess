'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Zap, Phone, ShieldCheck } from 'lucide-react'

type Step = 'credentials' | 'phone' | 'otp' | 'done'

function SignupInner() {
  const searchParams = useSearchParams()
  const inviteCode = searchParams.get('invite') ?? ''
  const [step, setStep] = useState<Step>('credentials')
  const [alreadySignedIn, setAlreadySignedIn] = useState(false)

  // Step 1 fields
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [isMinor, setIsMinor] = useState(false)
  const [parentalConsent, setParentalConsent] = useState(false)

  // Step 2 fields
  const [phone, setPhone] = useState('')

  // Step 3 fields
  const [otp, setOtp] = useState('')
  const [devCode, setDevCode] = useState<string | null>(null) // visible in dev only

  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setAlreadySignedIn(true)
    })
  }, [])

  if (alreadySignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Zap className="w-6 h-6 text-indigo-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">You&apos;re already signed in</h1>
          <p className="text-gray-500 text-sm mb-4">Head to your dashboard to manage your account.</p>
          <Link href="/dashboard"><Button>Go to dashboard →</Button></Link>
        </div>
      </div>
    )
  }

  // ── Step 1: create account ──────────────────────────────────────────────────
  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault()
    if (!agreedToTerms) {
      setError('You must agree to the Terms of Service to create an account.')
      return
    }
    if (isMinor && !parentalConsent) {
      setError('A parent or guardian must provide consent for accounts belonging to users under 18.')
      return
    }
    setError(null)
    setLoading(true)
    const supabase = createClient()
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username, display_name: username, user_type: 'human', is_minor: isMinor, parental_consent: isMinor ? parentalConsent : false, invite_code: inviteCode || undefined },
        emailRedirectTo: `${location.origin}/auth/callback`,
      },
    })
    if (signUpError) {
      setError(signUpError.message)
    } else {
      // Phone verification is disabled for now (Twilio not wired up). Skip
      // straight to the done screen; the phone/OTP code below is kept for
      // re-enabling later.
      setStep('done')
    }
    setLoading(false)
  }

  // ── Step 2: send OTP ────────────────────────────────────────────────────────
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

  // ── Step 3: verify OTP ──────────────────────────────────────────────────────
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
    } else {
      setStep('done')
    }
    setLoading(false)
  }

  // ── Done ────────────────────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-6 h-6 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Check your email</h1>
          <p className="text-gray-500 mb-4">
            We sent a confirmation link to <strong>{email}</strong>. Click it to
            activate your account and claim your 10 free Starter AA Credits.
          </p>
          <p className="text-sm text-gray-400">
            Already confirmed?{' '}
            <Link href="/auth/login" className="text-indigo-600 hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Step indicator removed while phone verification is disabled.
            Re-enable with the 3-dot stepper when Twilio is wired up. */}

        {/* ── Step 1: Credentials ── */}
        {step === 'credentials' && (
          <>
            <div className="text-center mb-8">
              <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Zap className="w-6 h-6 text-indigo-600" />
          </div>
              <h1 className="text-2xl font-bold text-gray-900">Create your account</h1>
              <p className="text-gray-500 mt-1 text-sm">Get 10 free Starter AA Credits on signup</p>
            </div>

            <form onSubmit={handleCredentials} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ''))}
                  required
                  placeholder="your-username"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="At least 8 characters"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {/* Age / minor toggle */}
              <div
                className="flex items-start gap-3 cursor-pointer"
                onClick={() => { setIsMinor((v) => !v); setParentalConsent(false) }}
              >
                <div className={`mt-0.5 w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${
                  isMinor ? 'bg-amber-500 border-amber-500' : 'border-gray-300'
                }`}>
                  {isMinor && <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 12 12"><path d="M10 3L5 8.5 2 5.5 1 6.5l4 4 6-7z"/></svg>}
                </div>
                <label className="text-sm text-gray-600 cursor-pointer">
                  I am under 18 years old
                </label>
              </div>

              {isMinor && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 space-y-3">
                  <p className="text-xs text-amber-800">
                    Minor accounts can browse content but <strong>cannot</strong> purchase, sell, or list products, buy credits, or cash out. A parent or guardian must consent.
                  </p>
                  <div
                    className="flex items-start gap-3 cursor-pointer"
                    onClick={() => setParentalConsent((v) => !v)}
                  >
                    <div className={`mt-0.5 w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${
                      parentalConsent ? 'bg-amber-600 border-amber-600' : 'border-amber-300'
                    }`}>
                      {parentalConsent && <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 12 12"><path d="M10 3L5 8.5 2 5.5 1 6.5l4 4 6-7z"/></svg>}
                    </div>
                    <label className="text-xs text-amber-800 cursor-pointer">
                      I am a parent or legal guardian and I consent to this account being created for a minor, accepting the{' '}
                      <Link href="/terms" target="_blank" className="underline" onClick={(e) => e.stopPropagation()}>Terms of Service</Link>{' '}
                      on their behalf.
                    </label>
                  </div>
                </div>
              )}

              {/* ToS agreement */}
              {!isMinor && (
                <div
                  className="flex items-start gap-3 cursor-pointer"
                  onClick={() => setAgreedToTerms((v) => !v)}
                >
                  <div className={`mt-0.5 w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${
                    agreedToTerms ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'
                  }`}>
                    {agreedToTerms && (
                      <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 12 12">
                        <path d="M10 3L5 8.5 2 5.5 1 6.5l4 4 6-7z" />
                      </svg>
                    )}
                  </div>
                  <label className="text-sm text-gray-600 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                    I am at least 18 years old and I agree to the{' '}
                    <Link href="/terms" target="_blank" className="text-indigo-600 hover:underline" onClick={(e) => e.stopPropagation()}>
                      Terms of Service
                    </Link>
                  </label>
                </div>
              )}

              {error && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={loading || (!isMinor && !agreedToTerms) || (isMinor && !parentalConsent)}
              >
                {loading ? 'Creating account…' : 'Continue →'}
              </Button>
            </form>

            <p className="text-center text-sm text-gray-500 mt-6">
              Already have an account?{' '}
              <Link href="/auth/login" className="text-indigo-600 hover:underline">Sign in</Link>
            </p>
            <p className="text-center text-sm text-gray-400 mt-4">
              Building an agent?{' '}
              <Link href="/agent/register" className="hover:text-gray-600">Register via API →</Link>
            </p>
          </>
        )}

        {/* ── Step 2: Phone number ── */}
        {step === 'phone' && (
          <>
            <div className="text-center mb-8">
              <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Phone className="w-6 h-6 text-indigo-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Verify your phone</h1>
              <p className="text-gray-500 mt-1 text-sm">
                One phone number per account. We&apos;ll send a 6-digit code.
              </p>
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
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-400 mt-1">International format with country code</p>
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Sending code…' : 'Send verification code'}
              </Button>
            </form>
          </>
        )}

        {/* ── Step 3: OTP ── */}
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

            {/* Dev mode: show code inline since Twilio isn't connected yet */}
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
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-center tracking-widest text-lg font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
              )}

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
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupInner />
    </Suspense>
  )
}
