'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Send, Bot, User, Loader2, Sparkles, Paperclip } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { BotRental, RentalMessage } from '@/types'

const POLL_INTERVAL_MS = 4000

export default function RentalChatPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [myId, setMyId] = useState<string | null>(null)
  const [rental, setRental] = useState<BotRental | null>(null)
  const [messages, setMessages] = useState<RentalMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const latestMsgId = useRef<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load current user
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace(`/auth/login?redirect=/rentals/${id}/chat`)
        return
      }
      setMyId(user.id)
    })
  }, [id, router])

  // Load rental info + messages
  const loadMessages = useCallback(async () => {
    const res = await fetch(`/api/rentals/${id}/messages`)
    if (!res.ok) return
    const json = await res.json()
    const msgs: RentalMessage[] = json.data?.messages ?? json.messages ?? []
    const last = msgs[msgs.length - 1]?.id ?? null
    if (last !== latestMsgId.current) {
      latestMsgId.current = last
      setMessages(msgs)
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
  }, [id])

  useEffect(() => {
    if (!myId) return
    Promise.all([
      fetch(`/api/rentals/${id}`).then((r) => r.ok ? r.json() : null),
      loadMessages(),
    ]).then(([rentalJson]) => {
      const rentalData = (rentalJson?.data ?? rentalJson) as BotRental | null
      setRental(rentalData)
      setLoading(false)
    })
  }, [id, myId, loadMessages])

  // Poll for new messages
  useEffect(() => {
    if (!myId || loading) return
    const interval = setInterval(loadMessages, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [myId, loading, loadMessages])

  // Upload a file to the bot's private file store via /api/bots/[botId]/files.
  // The route's access helper recognises an active rental and tags the upload
  // with rental_id automatically. On success we post a chat message pointing
  // at the file so both sides see it in the thread.
  async function uploadFile(file: File) {
    if (!rental?.bot_id) return
    if (file.size > 50 * 1024 * 1024) {
      setError('File exceeds 50 MB limit')
      return
    }
    setUploading(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`/api/bots/${rental.bot_id}/files`, {
        method: 'POST',
        body: form,
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Upload failed')
        return
      }
      // Post a chat message referencing the file
      const f = json.data?.file ?? json.file
      const noteRes = await fetch(`/api/rentals/${id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `📎 Shared file: **${f.filename}** (${Math.round(f.size_bytes / 1024)} KB) — available in the bot's files.`,
        }),
      })
      const noteJson = await noteRes.json()
      const msg = noteJson.data?.message ?? noteJson.message
      if (msg) {
        setMessages((prev) => [...prev, msg as RentalMessage])
        latestMsgId.current = msg.id
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      }
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) uploadFile(f)
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim() || sending) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch(`/api/rentals/${id}/messages`, {
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
          setMessages((prev) => [...prev, msg as RentalMessage])
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

  if (!rental) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-10 text-center">
        <p className="text-gray-500">Rental not found or you don&apos;t have access.</p>
        <Link href="/dashboard" className="text-indigo-600 text-sm mt-2 inline-block hover:underline">
          Back to dashboard
        </Link>
      </main>
    )
  }

  const isActive = rental.status === 'active'
  const bot = rental.bot

  return (
    <main className="max-w-3xl mx-auto px-4 py-6 h-[calc(100vh-56px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 flex-shrink-0">
        <Link href={`/rentals/${id}`} className="text-gray-400 hover:text-gray-700">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <Avatar
          name={bot?.display_name ?? 'Bot'}
          src={bot?.avatar_url ?? null}
          size="md"
          className="ring-2 ring-violet-100"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-900 truncate">{bot?.display_name ?? 'Bot'}</span>
            <Bot className="w-3.5 h-3.5 text-violet-500" />
          </div>
          <p className="text-xs text-gray-400">
            @{bot?.username} · {isActive ? 'Active rental' : 'Rental ended'}
          </p>
        </div>
        <span
          className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full ${
            isActive
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-gray-100 text-gray-500'
          }`}
        >
          {isActive ? 'Live' : 'Ended'}
        </span>
      </div>

      {/* Hint bar */}
      <div className="rounded-lg bg-indigo-50 border border-indigo-100 px-4 py-2.5 mb-3 text-xs text-indigo-800 flex items-center gap-2 flex-shrink-0">
        <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
        <span>
          Use this chat to direct the bot with tasks and instructions. The bot can also post
          results here via its API.
        </span>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto bg-white border border-gray-100 rounded-xl p-4 mb-3 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center text-gray-400 py-16">
            <Bot className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium">No messages yet.</p>
            <p className="text-xs mt-1">Start by sending the bot your first task.</p>
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
                    {isBot ? (
                      <Bot className="w-2.5 h-2.5 text-violet-500" />
                    ) : (
                      <User className="w-2.5 h-2.5 text-gray-400" />
                    )}
                  </div>
                  <div
                    className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                      isMe
                        ? 'bg-indigo-600 text-white rounded-br-sm'
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
      {isActive ? (
        <form onSubmit={sendMessage} className="flex gap-2 flex-shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={onFileInput}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="px-3 rounded-xl border border-gray-200 text-gray-500 hover:text-indigo-600 hover:border-indigo-300 transition-colors disabled:opacity-40"
            title="Share a file with the bot"
          >
            {uploading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Paperclip className="w-4 h-4" />}
          </button>
          <input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Direct the bot — paste a task, ask a question, give instructions…"
            maxLength={2000}
            disabled={sending}
            className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:bg-gray-50"
          />
          <Button type="submit" disabled={!content.trim() || sending} className="px-4">
            <Send className="w-4 h-4" />
          </Button>
        </form>
      ) : (
        <div className="text-center text-xs text-gray-400 py-3 border border-gray-100 rounded-xl flex-shrink-0">
          This rental has ended — messages are locked.
        </div>
      )}

      {error && (
        <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg mt-2">{error}</p>
      )}
    </main>
  )
}
