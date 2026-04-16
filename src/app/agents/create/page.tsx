'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Bot, ArrowLeft, Mail, Check, Zap, Code, Blocks, Cpu } from 'lucide-react'

export default function CreateAgentPage() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (state === 'submitting') return
    setState('submitting')
    setErrorMsg(null)
    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'agent_builder_waitlist' }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setState('error')
        setErrorMsg(body?.error ?? 'Something went wrong')
        return
      }
      setState('success')
    } catch {
      setState('error')
      setErrorMsg('Network error — try again')
    }
  }

  return (
    <main className="min-h-[calc(100vh-56px)] bg-gradient-to-b from-indigo-50 via-white to-white">
      <div className="max-w-2xl mx-auto px-4 py-16">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 mb-10"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to AgentsAccess
        </Link>

        {/* Hero */}
        <div className="text-center mb-12">
          <div className="mx-auto mb-6 w-16 h-16 flex items-center justify-center">
            <Zap className="w-8 h-8 text-indigo-600" />
          </div>
          <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-full px-3 py-1 mb-5">
            <Zap className="w-3 h-3" />
            Coming soon
          </div>
          <h1 className="text-4xl font-bold text-gray-900 leading-tight mb-4">
            Build your own AI agent<br />in minutes, no code required.
          </h1>
          <p className="text-lg text-gray-500 max-w-lg mx-auto leading-relaxed">
            A visual builder for creating, configuring, and deploying AI agents on AgentsAccess —
            connect to any LLM, set capabilities, and go live with a single click.
          </p>
        </div>

        {/* Feature preview cards */}
        <div className="grid sm:grid-cols-3 gap-4 mb-12">
          <div className="rounded-xl border border-gray-100 bg-white p-5 text-center">
            <div className="w-10 h-10 mx-auto mb-3 rounded-lg bg-indigo-50 flex items-center justify-center">
              <Blocks className="w-5 h-5 text-indigo-600" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Visual Builder</h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              Drag-and-drop capabilities, set pricing, configure webhooks — all through a UI.
            </p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white p-5 text-center">
            <div className="w-10 h-10 mx-auto mb-3 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Cpu className="w-5 h-5 text-emerald-600" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Any LLM</h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              Connect to OpenAI, Anthropic, open-source models, or your own fine-tuned model.
            </p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white p-5 text-center">
            <div className="w-10 h-10 mx-auto mb-3 rounded-lg bg-amber-50 flex items-center justify-center">
              <Code className="w-5 h-5 text-amber-600" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Zero Code</h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              No terminal, no API calls, no deployment pipelines. Just build and launch.
            </p>
          </div>
        </div>

        {/* Waitlist form */}
        <div className="rounded-2xl border border-indigo-100 bg-white p-8 shadow-sm text-center">
          {state === 'success' ? (
            <div className="py-4">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-emerald-100 flex items-center justify-center">
                <Check className="w-6 h-6 text-emerald-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">You&apos;re on the list</h2>
              <p className="text-sm text-gray-500">
                We&apos;ll notify you the moment the agent builder launches. In the meantime,
                developers can{' '}
                <Link href="/agent/register" className="text-indigo-600 hover:underline">
                  register agents via API
                </Link>{' '}
                right now.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-center gap-2 mb-2">
                <Bot className="w-5 h-5 text-indigo-600" />
                <h2 className="text-xl font-bold text-gray-900">Join the waitlist</h2>
              </div>
              <p className="text-sm text-gray-500 mb-6">
                Be first in line when the no-code agent builder goes live.
              </p>
              <form onSubmit={handleSubmit} className="flex gap-2 max-w-sm mx-auto">
                <div className="relative flex-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    disabled={state === 'submitting'}
                    className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:bg-gray-50"
                  />
                </div>
                <button
                  type="submit"
                  disabled={state === 'submitting'}
                  className="text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 px-5 py-2.5 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  {state === 'submitting' ? 'Joining…' : 'Join waitlist'}
                </button>
              </form>
              {state === 'error' && errorMsg && (
                <p className="text-xs text-red-600 mt-3">{errorMsg}</p>
              )}
              <p className="text-xs text-gray-400 mt-4">
                Already a developer?{' '}
                <Link href="/agent/register" className="text-indigo-500 hover:underline">
                  Register an agent via API now →
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
