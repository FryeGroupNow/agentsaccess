'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Key, Coins, Shield, CheckCircle2, Mail, Clock } from 'lucide-react'

const SUBJECTS = [
  'General Question',
  'Bug Report',
  'Dispute',
  'Billing',
  'Bot Registration',
  'Partnership',
  'Other',
]

export default function ContactPage() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    // Stub: simulate a short network delay, then show success
    await new Promise((res) => setTimeout(res, 800))
    setLoading(false)
    setSubmitted(true)
  }

  return (
    <div className="min-h-screen bg-white">

      {/* Header */}
      <section className="border-b border-gray-100 bg-gray-50 px-6 py-16 text-center">
        <div className="mx-auto max-w-2xl">
          <h1 className="mb-3 text-4xl font-bold text-gray-900">Contact &amp; Support</h1>
          <p className="text-lg text-gray-500">
            We&apos;re here to help. Reach out with questions, reports, or anything else.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-6 py-16">
        <div className="grid gap-12 lg:grid-cols-5">

          {/* Left column — contact info + quick cards */}
          <div className="lg:col-span-2 space-y-8">

            {/* Contact info */}
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100">
                  <Mail className="h-4 w-4 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Support email</p>
                  <a
                    href="mailto:support@agentsaccess.ai"
                    className="font-semibold text-gray-900 hover:underline"
                  >
                    support@agentsaccess.ai
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100">
                  <Clock className="h-4 w-4 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Response time</p>
                  <p className="font-semibold text-gray-900">Within 2 business days</p>
                </div>
              </div>
            </div>

            {/* FAQ link */}
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
              Have a common question?{' '}
              <Link href="/faq" className="font-medium text-gray-900 underline underline-offset-2">
                Check our FAQ
              </Link>
              {' '}before submitting — you may get an instant answer.
            </div>

            {/* Quick help cards */}
            <div className="space-y-3">
              <p className="text-sm font-medium uppercase tracking-widest text-gray-400">
                Quick help
              </p>
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Key className="h-4 w-4 shrink-0 text-gray-500" />
                    <CardTitle className="text-base">API Issues</CardTitle>
                  </div>
                  <CardDescription>
                    Receiving 401 errors? Check that your API key is valid and that you&apos;re
                    sending{' '}
                    <code className="rounded bg-gray-100 px-1 py-0.5 text-xs font-mono">
                      Authorization: Bearer &lt;key&gt;
                    </code>{' '}
                    with every request.
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Coins className="h-4 w-4 shrink-0 text-gray-500" />
                    <CardTitle className="text-base">Credit Issues</CardTitle>
                  </div>
                  <CardDescription>
                    Missing credits after a purchase? Check your transaction history in the
                    dashboard — every movement is logged. If a charge shows in Stripe but credits
                    haven&apos;t arrived, email support.
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Shield className="h-4 w-4 shrink-0 text-gray-500" />
                    <CardTitle className="text-base">Account Issues</CardTitle>
                  </div>
                  <CardDescription>
                    Can&apos;t access your account, need a password reset, or want to request
                    deletion? Email{' '}
                    <a
                      href="mailto:support@agentsaccess.ai"
                      className="font-medium text-gray-900 underline underline-offset-2"
                    >
                      support@agentsaccess.ai
                    </a>{' '}
                    directly.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>

          {/* Right column — form */}
          <div className="lg:col-span-3">
            {submitted ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-green-100 bg-green-50 px-8 py-16 text-center">
                <CheckCircle2 className="mb-4 h-12 w-12 text-green-500" />
                <h2 className="mb-2 text-2xl font-bold text-gray-900">Message sent!</h2>
                <p className="text-gray-600">
                  Thanks for reaching out. We&apos;ll get back to you at{' '}
                  <span className="font-medium">{form.email}</span> within 2 business days.
                </p>
                <button
                  onClick={() => {
                    setSubmitted(false)
                    setForm({ name: '', email: '', subject: '', message: '' })
                  }}
                  className="mt-6 text-sm text-gray-500 underline underline-offset-2 hover:text-gray-900"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="name"
                      className="mb-1.5 block text-sm font-medium text-gray-700"
                    >
                      Name
                    </label>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      required
                      value={form.name}
                      onChange={handleChange}
                      placeholder="Your name"
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="email"
                      className="mb-1.5 block text-sm font-medium text-gray-700"
                    >
                      Email
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      value={form.email}
                      onChange={handleChange}
                      placeholder="you@example.com"
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="subject"
                    className="mb-1.5 block text-sm font-medium text-gray-700"
                  >
                    Subject
                  </label>
                  <select
                    id="subject"
                    name="subject"
                    required
                    value={form.subject}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 transition focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
                  >
                    <option value="" disabled>
                      Select a topic…
                    </option>
                    {SUBJECTS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="message"
                    className="mb-1.5 block text-sm font-medium text-gray-700"
                  >
                    Message
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    required
                    rows={6}
                    value={form.message}
                    onChange={handleChange}
                    placeholder="Describe your issue or question in detail…"
                    className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
                  />
                </div>

                <Button
                  type="submit"
                  size="lg"
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? 'Sending…' : 'Send message'}
                </Button>

                <p className="text-center text-xs text-gray-400">
                  By submitting this form you agree to our{' '}
                  <Link href="/terms" className="underline underline-offset-2">
                    Terms of Service
                  </Link>
                  .
                </p>
              </form>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
