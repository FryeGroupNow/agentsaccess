'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { formatCredits } from '@/lib/utils'
import { ShoppingBag, Bot, User, Download, Palette, Info, X } from 'lucide-react'
import { calcAAFees } from '@/types'
import type { Product } from '@/types'
import { ReputationBadge } from '@/components/ui/reputation-badge'

const BUYBACK_NOTE =
  'Starter AA credits cannot be cashed out directly. The founder plans to buy them back at a minimum 1.25:1 ratio, aiming for 2:1 based on ecosystem activity.'

interface ProductCardProps {
  product: Product
  isOwn?: boolean
  hasPurchased?: boolean
}

export function ProductCard({ product, isOwn = false, hasPurchased = false }: ProductCardProps) {
  const [step, setStep] = useState<'idle' | 'confirm'>('idle')
  const [buying, setBuying] = useState(false)
  const [bought, setBought] = useState(hasPurchased)
  const [fileUrl, setFileUrl] = useState<string | null>(hasPurchased ? product.file_url : null)
  const [fileName, setFileName] = useState<string | null>(hasPurchased ? product.file_name : null)
  const [error, setError] = useState<string | null>(null)
  const [showBuybackInfo, setShowBuybackInfo] = useState(false)

  const fees = calcAAFees(product.price_credits)
  const seller = product.seller
  const soldOut = product.is_digital_art && !product.is_active && !bought && !isOwn
  const acceptsStarter = product.accept_starter_aa !== false // default true

  async function confirmBuy() {
    setBuying(true)
    setError(null)
    const res = await fetch(`/api/products/${product.id}/buy`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Purchase failed')
      setStep('idle')
    } else {
      setBought(true)
      setStep('idle')
      if (data.file_url) setFileUrl(data.file_url)
      if (data.file_name) setFileName(data.file_name)
    }
    setBuying(false)
  }

  return (
    <Card hover={step === 'idle'} className="flex flex-col gap-3 p-5">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge variant="default" className="text-xs">{product.category}</Badge>
          {product.is_digital_art && (
            <Badge variant="agent" className="text-xs">
              <Palette className="w-2.5 h-2.5 mr-0.5" />Digital Art
            </Badge>
          )}
        </div>
        <span className="text-sm font-semibold text-indigo-600 whitespace-nowrap">
          {formatCredits(product.price_credits)}
        </span>
      </div>

      {/* Title + description */}
      <div>
        <Link href={`/marketplace/${product.id}`} className="hover:underline">
          <h3 className="font-semibold text-gray-900 leading-snug">{product.title}</h3>
        </Link>
        <p className="text-sm text-gray-500 mt-1 line-clamp-2">{product.description}</p>
      </div>

      {/* File indicator */}
      {product.file_name && !bought && (
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <Download className="w-3 h-3" />
          Includes: {product.file_name}
        </div>
      )}

      {product.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {product.tags.slice(0, 4).map((tag) => (
            <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Digital art ownership */}
      {product.is_digital_art && product.current_owner && !isOwn && (
        <div className="text-xs text-gray-400">
          Owned by{' '}
          <Link href={`/profile/${product.current_owner.username}`} className="text-indigo-500 hover:underline">
            @{product.current_owner.username}
          </Link>
        </div>
      )}

      {/* Starter AA badge */}
      {!isOwn && !bought && !soldOut && (
        <div className="flex items-center gap-1.5">
          {acceptsStarter ? (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
              Accepts Starter AA
              <button
                onClick={() => setShowBuybackInfo((v) => !v)}
                className="text-emerald-500 hover:text-emerald-700"
                title="What is Starter AA?"
              >
                <Info className="w-3 h-3" />
              </button>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full">
              Redeemable AA only
              <button
                onClick={() => setShowBuybackInfo((v) => !v)}
                className="text-amber-500 hover:text-amber-700"
                title="What is Redeemable AA?"
              >
                <Info className="w-3 h-3" />
              </button>
            </span>
          )}
        </div>
      )}

      {/* Buyback info tooltip */}
      {showBuybackInfo && (
        <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-3 text-xs text-indigo-800 leading-relaxed">
          <div className="flex items-start justify-between gap-2">
            <p>{BUYBACK_NOTE}</p>
            <button onClick={() => setShowBuybackInfo(false)} className="text-indigo-400 hover:text-indigo-600 shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Bottom action row */}
      <div className="mt-auto pt-3 border-t border-gray-50">
        {step === 'confirm' ? (
          /* Fee breakdown confirmation */
          <div className="space-y-2">
            <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2.5 text-xs space-y-1">
              <div className="flex justify-between text-gray-600">
                <span>Price</span>
                <span>{formatCredits(product.price_credits)}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Buyer fee (2.5%)</span>
                <span>+{formatCredits(fees.buyer_fee)}</span>
              </div>
              <div className="flex justify-between font-semibold text-gray-900 border-t border-gray-200 pt-1 mt-1">
                <span>You pay</span>
                <span className="text-indigo-600">{formatCredits(fees.you_pay)}</span>
              </div>
              <div className="flex justify-between text-gray-400 text-[11px]">
                <span>Seller receives</span>
                <span>{formatCredits(fees.seller_receives)}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="flex-1" onClick={confirmBuy} disabled={buying}>
                {buying ? 'Processing…' : 'Confirm purchase'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setStep('idle')} disabled={buying}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            {seller ? (
              <Link
                href={`/profile/${seller.username}`}
                className="flex items-center gap-2 hover:opacity-80 transition-opacity min-w-0"
              >
                <Avatar name={seller.display_name} size="sm" />
                <div className="min-w-0">
                  <span className="text-xs text-gray-600 truncate block">{seller.display_name}</span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-xs text-gray-400 flex items-center gap-0.5">
                      {seller.user_type === 'agent' ? <><Bot className="w-3 h-3" /></> : <><User className="w-3 h-3" /></>}
                    </span>
                    <ReputationBadge score={seller.reputation_score} size="sm" />
                  </div>
                </div>
              </Link>
            ) : <div />}

            {isOwn ? (
              <Badge variant="default">Your listing</Badge>
            ) : bought ? (
              <div className="flex items-center gap-2">
                <Badge variant="success">Purchased</Badge>
                {fileUrl && (
                  <a href={fileUrl} download={fileName ?? undefined} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                    <Download className="w-3 h-3" />Download
                  </a>
                )}
              </div>
            ) : soldOut ? (
              <Badge variant="default" className="text-gray-400 bg-gray-100">Sold</Badge>
            ) : (
              <Button size="sm" onClick={() => setStep('confirm')}>
                <ShoppingBag className="w-3.5 h-3.5 mr-1.5" />
                Buy
              </Button>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">{error}</p>}

      <div className="text-xs text-gray-400">
        {product.purchase_count.toLocaleString()} sale{product.purchase_count !== 1 ? 's' : ''}
      </div>
    </Card>
  )
}
