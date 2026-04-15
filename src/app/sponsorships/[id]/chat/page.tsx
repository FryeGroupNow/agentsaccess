'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Send, Bot, User, Loader2, Handshake } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { RentalMessage } from '@/types'

// Reuses RentalMessage shape since sponsorship_messages has the same columns
type SponsorshipMessage = Omit<RentalMessage, 'rental_id'> & { agreement_id: string }

const POLL_INTERVAL_MS = 4000

export default function SponsorshipChatPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [myId, setMyId] = useState<string | null>(null)
  const [messages, setMessages] = useState<SponsorshipMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const latestMsgId = useRef<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace(`/auth/login?redirect=/sponsorships/${id}/chat`)
        return
      }
      setMyId(user.id)
    })
  }, [id, router])

  const loadMessages = useCallback(async () => {
    const res = await fetch(`/api/sponsorships/${id}/messages`)
    if (!res.ok) {
      if (res.status === 404) setError('Sponsorship not found')
      else if (res.status === 403) setError('You do not have access to this sponsorship')
      return
    }
    const json = await res.json()
    const msgs: SponsorshipMessage[] = json.data?.messages ?? json.messages ?? []
    const last = msgs[msgs.length - 1]?.id ?? null
    if (last !== latestMsgId.current) {
      latestMsgId.current = last
      setMessages(msgs)
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
  }, [id])

  useEffect(() => {
    if (!myId) return
    loadMessages().finally(() => setLoading(false))
  }, [myId, loadMessages])

  useEffect(() => {
    if (!myId || loading) return
    const interval = setInterval(loadMessages, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [myId, loading, loadMessages])

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim() || sending) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch(`/api/sponsorships/${id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim() }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Failed to send message')
      } else {
        setContent('')
        const msg = json.data?.message ?? json.message
        if (msg) {
          setMessages((prev) => [...prev, msg as SponsorshipMessage])
          latestMsgId.current = msg.id
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
        }
      }
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-gray-300 animate-spin" />
      </main>
    )
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-6 h-[calc(100vh-56px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 flex-shrink-0">
        <Link href="/dashboard" className="text-gray-400 hover:text-gray-700">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
          <Handshake className="w-5 h-5 text-purple-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-gray-900">Sponsorship chat</h1>
          <p className="text-xs text-gray-400">Dedicated channel between sponsor and sponsored bot</p>
        </div>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto bg-white border border-gray-100 rounded-xl p-4 mb-3 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center text-gray-400 py-16">
            <Handshake className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium">No messages yet.</p>
            <p className="text-xs mt-1">Kick things off with your first post.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_id === myId
            const sender = msg.sender
            const isBot = sender?.user_type === 'agent'
            return (
              <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                <Avatar
                  name={sender?.display_name ?? '?'}
                  src={sender?.avatar_url ?? null}
                  size="sm"
                  className={isBot ? 'ring-2 ring-violet-100' : ''}
                />
                <div className={`flex flex-col max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
                  <div className="flex items-center gap-1 mb-0.5">
                    <span className="text-[11px] font-semibold text-gray-600">
                      {sender?.display_name ?? 'Unknown'}
                    </span>
                    {isBot
                      ? <Bot className="w-2.5 h-2.5 text-violet-500" />
                      : <User className="w-2.5 h-2.5 text-gray-400" />}
                  </div>
                  <div
                    className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                      isMe
                        ? 'bg-purple-600 text-white rounded-br-sm'
                        : isBot
                          ? 'bg-violet-50 text-gray-900 rounded-bl-sm border border-violet-100'
                          : 'bg-gray-100 text-gray-900 rounded-bl-sm'
                    }`}
                  >
                    {msg.content}
                  </div>
                  <span className="text-[10px] text-gray-400 mt-0.5">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="flex gap-2 flex-shrink-0">
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Send the bot a task or update…"
          maxLength={2000}
          disabled={sending}
          className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 disabled:bg-gray-50"
        />
        <Button type="submit" disabled={!content.trim() || sending} className="px-4">
          <Send className="w-4 h-4" />
        </Button>
      </form>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg mt-2">{error}</p>
      )}
    </main>
  )
}
