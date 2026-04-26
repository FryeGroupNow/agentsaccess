'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCredits } from '@/lib/utils'
import { Briefcase, MessageSquare, Clock, CheckCircle, Play, X } from 'lucide-react'

type ServiceOrder = {
  id: string
  product_id: string
  buyer_id: string
  seller_id: string
  brief: string
  price_credits: number
  status: 'requested' | 'accepted' | 'rejected' | 'delivered' | 'confirmed' | 'cancelled' | 'disputed'
  delivery_note: string | null
  created_at: string
  conversation_id?: string | null
  product: { id: string; title: string; product_type: string; price_credits: number } | null
  buyer: { id: string; username: string; display_name: string; avatar_url: string | null } | null
  seller: { id: string; username: string; display_name: string; avatar_url: string | null } | null
}

const STATUS_STYLE: Record<ServiceOrder['status'], { label: string; className: string }> = {
  requested: { label: 'Requested', className: 'bg-amber-100 text-amber-800' },
  accepted:  { label: 'In progress', className: 'bg-blue-100 text-blue-800' },
  rejected:  { label: 'Rejected', className: 'bg-red-100 text-red-800' },
  delivered: { label: 'Delivered', className: 'bg-indigo-100 text-indigo-800' },
  confirmed: { label: 'Completed', className: 'bg-emerald-100 text-emerald-800' },
  cancelled: { label: 'Cancelled', className: 'bg-gray-100 text-gray-600' },
  disputed:  { label: 'Disputed', className: 'bg-red-100 text-red-800' },
}

export function ServiceOrdersPanel({ currentUserId }: { currentUserId: string }) {
  const [orders, setOrders] = useState<ServiceOrder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/services/orders', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        setOrders((d.orders ?? []) as ServiceOrder[])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  async function transition(id: string, status: ServiceOrder['status'], delivery_note?: string) {
    const res = await fetch(`/api/services/orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(delivery_note ? { status, delivery_note } : { status }),
    })
    if (res.ok) {
      const data = await res.json()
      const updated = data.order as ServiceOrder
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, ...updated } : o)))
    } else {
      const err = await res.json().catch(() => ({}))
      alert(err.error ?? `Failed to mark ${status}`)
    }
  }

  async function markDelivered(id: string) {
    const note = window.prompt('Delivery note (optional) — describe what you delivered:') ?? ''
    await transition(id, 'delivered', note.trim() || undefined)
  }
  const confirmDelivery = (id: string) => transition(id, 'confirmed')
  const cancelOrder    = (id: string) => {
    if (confirm('Cancel this order? Funds remain with the seller until a dispute is resolved.')) {
      transition(id, 'cancelled')
    }
  }

  if (loading) return <p className="text-xs text-gray-400">Loading…</p>
  if (orders.length === 0) return <p className="text-xs text-gray-400">No service orders yet.</p>

  return (
    <div className="space-y-3">
      {orders.map((o) => {
        const isBuyer = o.buyer_id === currentUserId
        const counterparty = isBuyer ? o.seller : o.buyer
        const style = STATUS_STYLE[o.status]
        const orderTag = o.id.slice(0, 8)
        const chatHref = o.conversation_id
          ? `/messages/${o.conversation_id}`
          : `/profile/${counterparty?.username ?? ''}`
        const canCancel = (o.status === 'accepted' || o.status === 'requested')
        return (
          <div key={o.id} className="rounded-lg border border-gray-200 p-3 bg-white">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Briefcase className="w-4 h-4 text-indigo-500 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-gray-900 truncate">
                    {o.product?.title ?? 'Service'}
                  </div>
                  <div className="text-xs text-gray-500">
                    <span className="font-mono text-gray-400">#{orderTag}</span>
                    {' · '}
                    {isBuyer ? 'You hired' : 'Hired by'} @{counterparty?.username ?? 'unknown'}
                    {' · '}
                    {formatCredits(o.price_credits)}
                  </div>
                </div>
              </div>
              <Badge className={style.className}>{style.label}</Badge>
            </div>

            <p className="text-xs text-gray-600 mt-2 line-clamp-2">{o.brief}</p>

            {o.delivery_note && o.status !== 'cancelled' && o.status !== 'rejected' && (
              <p className="text-xs text-emerald-700 mt-2 bg-emerald-50 border border-emerald-100 rounded px-2 py-1.5">
                <span className="font-semibold">Delivery note:</span> {o.delivery_note}
              </p>
            )}

            <div className="flex gap-2 mt-3 flex-wrap">
              {/* Seller actions */}
              {!isBuyer && o.status === 'accepted' && (
                <Button size="sm" onClick={() => markDelivered(o.id)}>
                  <Clock className="w-3 h-3 mr-1" />
                  Deliver service
                </Button>
              )}
              {!isBuyer && o.status === 'requested' && (
                <Button size="sm" variant="secondary" onClick={() => transition(o.id, 'accepted')}>
                  <Play className="w-3 h-3 mr-1" />
                  Accept
                </Button>
              )}
              {/* Buyer actions */}
              {isBuyer && o.status === 'accepted' && (
                <span className="text-[11px] text-gray-400 italic px-1 self-center">
                  Waiting on seller — message them to schedule
                </span>
              )}
              {isBuyer && o.status === 'delivered' && (
                <Button size="sm" onClick={() => confirmDelivery(o.id)}>
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Confirm received
                </Button>
              )}
              {canCancel && (
                <Button size="sm" variant="secondary" className="text-red-600 hover:bg-red-50"
                  onClick={() => cancelOrder(o.id)}>
                  <X className="w-3 h-3 mr-1" />
                  Cancel
                </Button>
              )}
              <Link
                href={chatHref}
                className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline px-2 py-1.5"
              >
                <MessageSquare className="w-3 h-3" />
                Open chat
              </Link>
            </div>
          </div>
        )
      })}
    </div>
  )
}
