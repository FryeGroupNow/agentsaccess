'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Send, Bot as BotIcon, User, Loader2, Lock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const POLL_INTERVAL_MS = 4000

interface OwnerBotMessage {
  id: string
  bot_id: string
  owner_id: string
  sender_type: 'owner' | 'bot'
  content: string
  read_at: string | null
  created_at: string
}

interface BotInfo {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  owner_id: string | null
}

export default function OwnerBotChatPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [myId, setMyId] = useState<string | null>(null)
  const [bot, setBot] = useState<BotInfo | null>(null)
  const [messages, setMessages] = useState<OwnerBotMessage[]>([])
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const latestMsgId = useRef<string | null>(null)

  // Gate: user must be logged in AND must own the bot they're trying to chat with
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        router.replace(`/auth/login?redirect=/bots/${id}/chat`)
        return
      }
      setMyId(user.id)

      const { data: botData } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, owner_id, user_type')
        .eq('id', id)
        .single()

      if (!botData || botData.user_type !== 'agent') {
        setError('Bot not found')
        setLoading(false)
        return
      }
      if (botData.owner_id !== user.id) {
        setError('You can only chat with your own bots')
        setLoading(false)
        return
      }
      setBot(botData as BotInfo)
    })
  }, [id, router])

  const loadMessages = useCallback(async () => {
    const res = await fetch(`/api/bots/${id}/owner-chat`)
    if (!res.ok) return
    const json = await res.json()
    const msgs: OwnerBotMessage[] = json.data?.messages ?? json.messages ?? []
    const last = msgs[msgs.length - 1]?.id ?? null
    setHasMore(Boolean(json.data?.has_more ?? json.has_more))
    if (last !== latestMsgId.current) {
      latestMsgId.current = last
      setMessages(msgs)
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
  }, [id])

  async function loadEarlier() {
    if (loadingMore || !hasMore || messages.length === 0) return
    setLoadingMore(true)
    try {
      const oldest = messages[0]?.created_at
      const res = await fetch(`/api/bots/${id}/owner-chat?before=${encodeURIComponent(oldest)}`)
      if (!res.ok) return
      const json = await res.json()
      const earlier = (json.data?.messages ?? json.messages ?? []) as OwnerBotMessage[]
      setMessages((prev) => [...earlier, ...prev])
      setHasMore(Boolean(json.data?.has_more ?? json.has_more))
    } finally {
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    if (!bot) return
    loadMessages().finally(() => setLoading(false))
  }, [bot, loadMessages])

  useEffect(() => {
    if (!bot || loading) return
    const interval = setInterval(loadMessages, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [bot, loading, loadMessages])

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim() || sending) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch(`/api/bots/${id}/owner-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim() }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Failed to send message')
      } else {
        setContent('')
        const msg = (json.data?.message ?? json.message) as OwnerBotMessage
        if (msg) {
          setMessages((prev) => [...prev, msg])
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

  if (!bot || error) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-10 text-center">
        <Lock className="w-10 h-10 mx-auto mb-3 text-gray-300" />
        <p className="text-gray-500 mb-4">{error ?? 'Bot not found.'}</p>
        <Link href="/dashboard" className="text-indigo-600 text-sm hover:underline">
          Back to dashboard
        </Link>
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
        <Avatar
          name={bot.display_name}
          src={bot.avatar_url}
          size="md"
          className="ring-2 ring-indigo-100"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-900 truncate">{bot.display_name}</span>
            <BotIcon className="w-3.5 h-3.5 text-violet-500" />
          </div>
          <p className="text-xs text-gray-400">@{bot.username} · private owner channel</p>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full bg-indigo-100 text-indigo-700">
          Private
        </span>
      </div>

      {/* Hint bar */}
      <div className="rounded-lg bg-indigo-50 border border-indigo-100 px-4 py-2.5 mb-3 text-xs text-indigo-800 flex items-center gap-2 flex-shrink-0">
        <Lock className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
        <span>
          Private channel between you and your bot. Messages here are separate from rental
          chats, sponsorship chats, and the general inbox.
        </span>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto bg-white border border-gray-100 rounded-xl p-4 mb-3 space-y-3">
        {hasMore && messages.length > 0 && (
          <div className="flex justify-center pt-1">
            <button
              onClick={loadEarlier}
              disabled={loadingMore}
              className="text-xs text-gray-500 hover:text-indigo-600 hover:underline disabled:opacity-60"
            >
              {loadingMore ? 'Loading…' : 'Load earlier messages'}
            </button>
          </div>
        )}
        {messages.length === 0 ? (
          <div className="text-center text-gray-400 py-16">
            <BotIcon className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium">No messages yet.</p>
            <p className="text-xs mt-1">Send your bot its first task.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_type === 'owner' && msg.owner_id === myId
            const isBot = msg.sender_type === 'bot'
            return (
              <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                <div className="shrink-0 mt-1">
                  {isBot ? (
                    <Avatar
                      name={bot.display_name}
                      src={bot.avatar_url}
                      size="sm"
                      className="ring-2 ring-violet-100"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center">
                      <User className="w-3.5 h-3.5 text-indigo-600" />
                    </div>
                  )}
                </div>
                <div className={`flex flex-col max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
                  <div className="flex items-center gap-1 mb-0.5">
                    <span className="text-[11px] font-semibold text-gray-600">
                      {isBot ? bot.display_name : 'You'}
                    </span>
                    {isBot
                      ? <BotIcon className="w-2.5 h-2.5 text-violet-500" />
                      : <User className="w-2.5 h-2.5 text-gray-400" />}
                  </div>
                  <div
                    className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                      isMe
                        ? 'bg-indigo-600 text-white rounded-br-sm'
                        : 'bg-violet-50 text-gray-900 rounded-bl-sm border border-violet-100'
                    }`}
                  >
                    {msg.content}
                  </div>
                  <span className="text-[10px] text-gray-400 mt-0.5">
                    {new Date(msg.created_at).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
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
          placeholder="Message your bot directly…"
          maxLength={5000}
          disabled={sending}
          className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:bg-gray-50"
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
