'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Send, Bot } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

interface Message {
  id: string
  content: string
  sender_id: string
  created_at: string
  sender: {
    id: string
    username: string
    display_name: string
    user_type: string
    avatar_url: string | null
  } | null
}

interface OtherParty {
  id: string
  username: string
  display_name: string
  user_type: string
  avatar_url: string | null
  bio: string | null
}

export default function ConversationPage() {
  const { id } = useParams<{ id: string }>()
  const [messages, setMessages] = useState<Message[]>([])
  const [other, setOther] = useState<OtherParty | null>(null)
  const [myId, setMyId] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setMyId(user.id)
    })
  }, [])

  // Poll the conversation every 10s so new messages arrive without a manual
  // refresh. `GET /api/messages/[id]` also marks messages read as a side
  // effect, which is exactly what we want — opening the thread clears the
  // unread count everywhere (navbar badge + inbox bold highlight).
  useEffect(() => {
    if (!id) return
    let cancelled = false

    async function load() {
      try {
        const res = await fetch(`/api/messages/${id}`, { cache: 'no-store' })
        if (!res.ok) return
        const body = await res.json()
        if (!cancelled) {
          setMessages(body.messages ?? [])
          setOther(body.other_party ?? null)
          setLoading(false)
        }
      } catch {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    const interval = setInterval(load, 10_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim() || sending || !other) return
    setSending(true)

    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to_id: other.id, content: content.trim() }),
    })
    const body = await res.json()

    if (res.ok && body.message) {
      setMessages((prev) => [...prev, body.message])
      setContent('')
    }
    setSending(false)
  }

  function timeLabel(date: string) {
    const d = new Date(date)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-6 flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 flex-shrink-0">
        <Link href="/messages" className="text-gray-400 hover:text-gray-700">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        {other && (
          <>
            <Avatar src={other.avatar_url} name={other.display_name} className="w-9 h-9" />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-gray-900">{other.display_name}</span>
                {other.user_type === 'agent' && <Bot className="w-3.5 h-3.5 text-indigo-500" />}
              </div>
              <Link href={`/profile/${other.username}`} className="text-xs text-gray-400 hover:text-indigo-500">
                @{other.username}
              </Link>
            </div>
          </>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-2">
        {loading ? (
          <div className="flex justify-center items-center h-full text-gray-400 text-sm">Loading…</div>
        ) : messages.length === 0 ? (
          <div className="flex justify-center items-center h-full text-gray-400 text-sm">No messages yet. Say hello!</div>
        ) : (
          messages.map((m) => {
            const isMe = m.sender_id === myId
            return (
              <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} gap-2`}>
                {!isMe && (
                  <Avatar
                    src={m.sender?.avatar_url}
                    name={m.sender?.display_name ?? '?'}
                    className="w-7 h-7 flex-shrink-0 mt-1"
                  />
                )}
                <div className={`max-w-[75%] group`}>
                  <div
                    className={`px-3.5 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
                      isMe
                        ? 'bg-indigo-600 text-white rounded-br-sm'
                        : 'bg-gray-100 text-gray-900 rounded-bl-sm'
                    }`}
                  >
                    {m.content}
                  </div>
                  <div className={`text-[10px] text-gray-400 mt-0.5 ${isMe ? 'text-right' : 'text-left'}`}>
                    {timeLabel(m.created_at)}
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="flex gap-2 mt-3 flex-shrink-0">
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(e as unknown as React.FormEvent) } }}
          placeholder="Type a message…"
          maxLength={5000}
          className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          disabled={sending}
        />
        <Button type="submit" size="sm" disabled={!content.trim() || sending} className="px-4">
          <Send className="w-4 h-4" />
        </Button>
      </form>
    </main>
  )
}
