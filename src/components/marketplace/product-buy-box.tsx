'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCredits } from '@/lib/utils'
import { ShoppingBag, Download, CheckCircle } from 'lucide-react'
import { calcAAFees } from '@/types'
import type { Product } from '@/types'
import Link from 'next/link'

interface ProductBuyBoxProps {
  product: Product
  isOwn: boolean
  hasPurchased: boolean
  isLoggedIn: boolean
}

export function ProductBuyBox({ product, isOwn, hasPurchased: initialPurchased, isLoggedIn }: ProductBuyBoxProps) {
  const [step, setStep] = useState<'idle' | 'confirm'>('idle')
  const [buying, setBuying] = useState(false)
  const [bought, setBought] = useState(initialPurchased)
  const [fileUrl, setFileUrl] = useState<string | null>(initialPurchased ? product.file_url : null)
  const [fileName, setFileName] = useState<string | null>(initialPurchased ? product.file_name : null)
  const [error, setError] = useState<string | null>(null)

  const fees = calcAAFees(product.price_credits)
  const soldOut = product.is_digital_art && !product.is_active && !bought && !isOwn

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

  if (isOwn) {
    return <Badge variant="default" className="w-full justify-center py-2 text-sm">Your listing</Badge>
  }

  if (soldOut) {
    return <Badge variant="default" className="w-full justify-center py-2 text-sm bg-gray-100 text-gray-500">Sold</Badge>
  }

  if (bought) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-center gap-2 bg-green-50 text-green-700 rounded-lg py-3 font-medium text-sm">
          <CheckCircle className="w-4 h-4" />
          Purchased
        </div>
        {fileUrl && (
          <a
            href={fileUrl}
            download={fileName ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="secondary" className="w-full">
              <Download className="w-4 h-4 mr-2" />
              Download {fileName}
            </Button>
          </a>
        )}
      </div>
    )
  }

  if (!isLoggedIn) {
    return (
      <div className="space-y-3">
        <Link href="/auth/login">
          <Button className="w-full" size="lg">
            <ShoppingBag className="w-4 h-4 mr-2" />
            Sign in to buy
          </Button>
        </Link>
        <p className="text-xs text-gray-400 text-center">
          Don&apos;t have an account?{' '}
          <Link href="/auth/signup" className="text-indigo-500 hover:underline">Sign up free</Link>
        </p>
      </div>
    )
  }

  if (step === 'confirm') {
    return (
      <div className="space-y-3">
        <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-sm space-y-2">
          <div className="flex justify-between text-gray-600">
            <span>Price</span>
            <span>{formatCredits(product.price_credits)}</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>Buyer fee (2.5%)</span>
            <span>+{formatCredits(fees.buyer_fee)}</span>
          </div>
          <div className="flex justify-between font-semibold text-gray-900 border-t border-gray-200 pt-2 mt-1">
            <span>You pay</span>
            <span className="text-indigo-600">{formatCredits(fees.you_pay)}</span>
          </div>
          <div className="flex justify-between text-gray-400 text-xs">
            <span>Seller receives</span>
            <span>{formatCredits(fees.seller_receives)}</span>
          </div>
        </div>
        <Button className="w-full" size="lg" onClick={confirmBuy} disabled={buying}>
          {buying ? 'Processing…' : 'Confirm purchase'}
        </Button>
        <Button variant="ghost" className="w-full" onClick={() => setStep('idle')} disabled={buying}>
          Cancel
        </Button>
        {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <Button className="w-full" size="lg" onClick={() => setStep('confirm')}>
        <ShoppingBag className="w-4 h-4 mr-2" />
        Buy now
      </Button>
      {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
    </div>
  )
}
