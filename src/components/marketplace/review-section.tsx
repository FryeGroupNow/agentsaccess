'use client'

import { useState, useEffect, useCallback } from 'react'
import { Star, Bot, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'

interface Review {
  id: string
  rating: number
  review_text: string | null
  seller_response: string | null
  reviewer_type: string
  created_at: string
  reviewer: {
    id: string
    username: string
    display_name: string
    user_type: string
    avatar_url: string | null
  } | null
}

interface Props {
  productId: string
  hasPurchased: boolean
  sellerId: string
  currentUserId: string | null
}

function Stars({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'lg' }) {
  const sz = size === 'lg' ? 'w-5 h-5' : 'w-3.5 h-3.5'
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`${sz} ${s <= rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`}
        />
      ))}
    </div>
  )
}

function ReviewForm({ productId, onSubmitted }: { productId: string; onSubmitted: () => void }) {
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (rating < 1) { setError('Please select a rating'); return }
    setSubmitting(true)
    setError('')
    const res = await fetch(`/api/products/${productId}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating, review_text: text.trim() || undefined }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error ?? 'Failed to submit'); setSubmitting(false); return }
    onSubmitted()
  }

  return (
    <form onSubmit={submit} className="bg-indigo-50 rounded-xl p-4 space-y-3">
      <p className="font-medium text-gray-800 text-sm">Write a review</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((s) => (
          <button
            key={s}
            type="button"
            onMouseEnter={() => setHovered(s)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => setRating(s)}
          >
            <Star className={`w-6 h-6 transition-colors ${s <= (hovered || rating) ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
          </button>
        ))}
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Share your experience (optional)…"
        rows={3}
        maxLength={1000}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
      />
      {error && <p className="text-red-500 text-xs">{error}</p>}
      <Button type="submit" size="sm" disabled={submitting}>
        {submitting ? 'Submitting…' : 'Submit review'}
      </Button>
    </form>
  )
}

export function ReviewSection({ productId, hasPurchased, sellerId, currentUserId }: Props) {
  const [data, setData] = useState<{
    reviews: Review[]
    average_rating: number | null
    review_count: number
  } | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [showAll, setShowAll] = useState(false)

  const load = useCallback(() => {
    fetch(`/api/products/${productId}/reviews`)
      .then((r) => r.json())
      .then(({ data: d }) => setData(d))
  }, [productId])

  useEffect(() => { load() }, [load])

  const isSeller = currentUserId === sellerId
  const canReview = hasPurchased && !isSeller

  const displayed = showAll ? (data?.reviews ?? []) : (data?.reviews ?? []).slice(0, 4)

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-gray-900">Reviews</h3>
          {data?.average_rating && (
            <div className="flex items-center gap-1.5">
              <Stars rating={Math.round(data.average_rating)} />
              <span className="text-sm font-medium text-gray-700">{data.average_rating.toFixed(1)}</span>
              <span className="text-sm text-gray-400">({data.review_count})</span>
            </div>
          )}
        </div>
        {canReview && !showForm && (
          <Button size="sm" variant="ghost" onClick={() => setShowForm(true)}>
            Write a review
          </Button>
        )}
      </div>

      {showForm && (
        <ReviewForm
          productId={productId}
          onSubmitted={() => { setShowForm(false); load() }}
        />
      )}

      {/* Reviews list */}
      <div className="space-y-4">
        {displayed.map((r) => (
          <div key={r.id} className="border-b border-gray-100 pb-4 last:border-0">
            <div className="flex items-start gap-3">
              <Avatar
                src={r.reviewer?.avatar_url}
                fallback={r.reviewer?.display_name?.[0] ?? '?'}
                className="w-8 h-8 flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm text-gray-900">{r.reviewer?.display_name}</span>
                  {r.reviewer_type === 'agent' && (
                    <span className="flex items-center gap-1 text-xs text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-full">
                      <Bot className="w-3 h-3" />AI
                    </span>
                  )}
                  <Stars rating={r.rating} />
                  <span className="text-xs text-gray-400 ml-auto">
                    {new Date(r.created_at).toLocaleDateString()}
                  </span>
                </div>
                {r.review_text && (
                  <p className="mt-1 text-sm text-gray-600 leading-relaxed">{r.review_text}</p>
                )}
                {r.seller_response && (
                  <div className="mt-2 bg-gray-50 rounded-lg px-3 py-2">
                    <p className="text-xs font-medium text-gray-500 mb-1">Seller response</p>
                    <p className="text-sm text-gray-700">{r.seller_response}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {(data?.reviews.length ?? 0) > 4 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700"
          >
            {showAll ? (
              <><ChevronUp className="w-4 h-4" />Show fewer</>
            ) : (
              <><ChevronDown className="w-4 h-4" />Show all {data?.review_count} reviews</>
            )}
          </button>
        )}

        {!data || data.reviews.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No reviews yet.</p>
        ) : null}
      </div>
    </div>
  )
}
