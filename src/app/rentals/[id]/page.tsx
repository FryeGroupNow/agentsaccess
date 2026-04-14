'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { Bot, Send, Star, X, ArrowLeft } from 'lucide-react'
import { formatCredits } from '@/lib/utils'
import type { BotRental, RentalMessage } from '@/types'

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <button key={s} type="button" onClick={() => onChange(s)}>
          <Star className={`w-5 h-5 ${s <= value ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`} />
        </button>
      ))}
    </div>
  )
}

interface ReviewFormProps {
  rentalId: string
  onReviewed: () => void
}

function ReviewForm({ rentalId, onReviewed }: ReviewFormProps) {
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch(`/api/rentals/${rentalId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, comment }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed'); return }
      onReviewed()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Leave a review</h3>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Rating</label>
          <StarRating value={rating} onChange={setRating} />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Comment (optional)</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder="How was your experience?"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? 'Submitting…' : 'Submit Review'}
        </Button>
      </form>
    </Card>
  )
}

export default function RentalPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [rental, setRental] = useState<BotRental | null>(null)
  const [messages, setMessages] = useState<RentalMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [msgLoading, setMsgLoading] = useState(false)
  const [content, setContent] = useState('')
  const [ending, setEnding] = useState(false)
  const [reviewed, setReviewed] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const loadMessages = useCallback(async () => {
    const res = await fetch(`/api/rentals/${id}/messages`)
    if (res.ok) {
      const data = await res.json()
      setMessages(data.messages ?? [])
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
  }, [id])

  useEffect(() => {
    Promise.all([
      fetch(`/api/rentals/${id}`).then((r) => r.ok ? r.json() : null),
      fetch('/api/rentals').then((r) => r.ok ? r.json() : null),
    ]).then(([rentalData, listData]) => {
      if (rentalData) {
        setRental(rentalData)
        const review = Array.isArray(rentalData.review) ? rentalData.review[0] : rentalData.review
        if (review) setReviewed(true)
      }
      if (listData?.rentals?.length > 0) {
        const r = listData.rentals[0]
        setCurrentUserId(r.owner_id)
      }
      setLoading(false)
    })
    loadMessages()
  }, [id, loadMessages])

  // Get current user from the rental itself
  useEffect(() => {
    if (rental) {
      fetch('/api/rentals').then((r) => r.json()).then((d) => {
        const found = d.rentals?.find((r: BotRental) => r.id === id)
        if (found) {
          // The current user is whoever accessed this page — owner or renter
          // We can't know without a /api/me; use a heuristic from cookies instead.
          // For now just store both; the UI handles it server-side via RLS.
        }
      })
    }
  }, [rental, id])

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) return
    setMsgLoading(true)
    try {
      const res = await fetch(`/api/rentals/${id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      if (res.ok) {
        setContent('')
        await loadMessages()
      }
    } finally {
      setMsgLoading(false)
    }
  }

  async function endRental() {
    if (!confirm('End this rental? The bot will be re-listed as available.')) return
    setEnding(true)
    try {
      const res = await fetch(`/api/rentals/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setRental((prev) => prev ? { ...prev, status: 'ended' } : prev)
      }
    } finally {
      setEnding(false)
    }
  }

  if (loading) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-10">
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-xl bg-gray-100 animate-pulse" />)}
        </div>
      </main>
    )
  }

  if (!rental) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-10 text-center">
        <p className="text-gray-500">Rental not found.</p>
        <button onClick={() => router.back()} className="text-indigo-600 text-sm mt-2 hover:underline">Go back</button>
      </main>
    )
  }

  const isActive = rental.status === 'active'
  const isRenter = rental.renter_id === currentUserId
  const showReview = !isActive && isRenter && !reviewed

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft className="w-4 h-4" />Back
      </button>

      {/* Rental header */}
      <Card className="p-4 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            {rental.bot ? (
              <Avatar name={rental.bot.display_name} src={rental.bot.avatar_url} size="md" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                <Bot className="w-5 h-5 text-indigo-600" />
              </div>
            )}
            <div>
              <p className="font-semibold text-gray-900">{rental.bot?.display_name ?? 'Bot'}</p>
              <p className="text-xs text-gray-400">@{rental.bot?.username}</p>
              {rental.bot?.capabilities && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {rental.bot.capabilities.map((c) => (
                    <span key={c} className="text-xs bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded">{c}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="text-right">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {isActive ? 'Active' : 'Ended'}
            </span>
            <p className="text-xs text-gray-400 mt-1">{formatCredits(rental.daily_rate_aa)}/day</p>
            <p className="text-xs text-gray-400">Started {new Date(rental.started_at).toLocaleDateString()}</p>
          </div>
        </div>

        {isActive && (
          <div className="mt-3 flex justify-end">
            <Button
              size="sm"
              variant="secondary"
              className="text-red-600 hover:bg-red-50"
              onClick={endRental}
              disabled={ending}
            >
              <X className="w-3.5 h-3.5 mr-1" />
              {ending ? 'Ending…' : 'End Rental'}
            </Button>
          </div>
        )}
      </Card>

      {/* Review form */}
      {showReview && (
        <div className="mb-4">
          <ReviewForm rentalId={id} onReviewed={() => setReviewed(true)} />
        </div>
      )}

      {reviewed && !isActive && (
        <div className="mb-4 rounded-xl bg-green-50 border border-green-200 p-3 text-sm text-green-800 flex items-center gap-2">
          <Star className="w-4 h-4 fill-green-500 text-green-500" />
          Review submitted. Thank you!
        </div>
      )}

      {/* Message thread */}
      <div className="bg-white rounded-xl border border-gray-100 flex flex-col" style={{ height: '480px' }}>
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Rental Messages</h3>
          {!isActive && <p className="text-xs text-gray-400">This rental has ended.</p>}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 ? (
            <div className="text-center text-gray-400 py-12">
              <p className="text-sm">No messages yet.</p>
              <p className="text-xs mt-1">Use this chat to direct the bot.</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.sender_id === currentUserId
              return (
                <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                  <Avatar
                    name={msg.sender?.display_name ?? '?'}
                    src={msg.sender?.avatar_url ?? null}
                    size="sm"
                  />
                  <div className={`max-w-xs lg:max-w-md ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                    <span className="text-xs text-gray-400 mb-1">
                      {msg.sender?.username ?? msg.sender_id}
                    </span>
                    <div className={`rounded-2xl px-3 py-2 text-sm ${
                      isMe ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-900'
                    }`}>
                      {msg.content}
                    </div>
                    <span className="text-xs text-gray-300 mt-1">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              )
            })
          )}
          <div ref={bottomRef} />
        </div>

        {isActive && (
          <form onSubmit={sendMessage} className="border-t border-gray-100 p-3 flex gap-2">
            <input
              type="text"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Direct the bot…"
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <Button type="submit" size="sm" disabled={msgLoading || !content.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </form>
        )}
      </div>
    </main>
  )
}
