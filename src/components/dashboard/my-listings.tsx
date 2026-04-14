'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CreateListingModal } from './create-listing-modal'
import { EditListingModal } from './edit-listing-modal'
import { formatCreditsWithUSD } from '@/lib/utils'
import { ShoppingBag, Plus, Trash2, Eye, EyeOff, Pencil, Megaphone } from 'lucide-react'
import { PromoteModal } from '@/components/ads/promote-modal'
import { ConfirmDeleteModal } from '@/components/ui/confirm-delete-modal'
import type { Product } from '@/types'

interface MyListingsProps {
  initialListings: Product[]
}

export function MyListings({ initialListings }: MyListingsProps) {
  const [listings, setListings] = useState<Product[]>(initialListings)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [promotingProduct, setPromotingProduct] = useState<Product | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null)

  function handleCreated(product: Product) {
    setListings((prev) => [product, ...prev])
  }

  function handleSaved(updated: Product) {
    setListings((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
  }

  async function handleToggleActive(product: Product) {
    setToggling(product.id)
    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !product.is_active }),
      })
      if (res.ok) {
        setListings((prev) =>
          prev.map((p) => (p.id === product.id ? { ...p, is_active: !p.is_active } : p))
        )
      }
    } finally {
      setToggling(null)
    }
  }

  async function confirmDelete(id: string) {
    setDeleteTarget(null)
    setDeleting(id)
    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' })
      if (res.ok) setListings((prev) => prev.filter((p) => p.id !== id))
    } finally {
      setDeleting(null)
    }
  }

  const activeListings = listings.filter((p) => p.is_active)
  const inactiveListings = listings.filter((p) => !p.is_active)

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-gray-900">
          My Listings
          <span className="ml-1.5 text-sm font-normal text-gray-400">({activeListings.length} active)</span>
        </h2>
        <Button size="sm" variant="secondary" onClick={() => setShowCreateModal(true)}>
          <Plus className="w-3.5 h-3.5 mr-1" />
          New Listing
        </Button>
      </div>

      {listings.length === 0 ? (
        <Card className="p-5 text-center">
          <ShoppingBag className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p className="text-sm text-gray-400 mb-3">No listings yet. Create your first product.</p>
          <Button size="sm" onClick={() => setShowCreateModal(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" />
            Create listing
          </Button>
        </Card>
      ) : (
        <div className="space-y-2">
          {[...activeListings, ...inactiveListings].map((product) => (
            <Card key={product.id} className={`p-4 ${!product.is_active ? 'opacity-60' : ''}`}>
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-medium text-gray-900 truncate">{product.title}</p>
                    {!product.is_active && (
                      <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded shrink-0">Inactive</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">
                    {product.category} · {product.purchase_count} sale{product.purchase_count !== 1 ? 's' : ''}
                    {' · '}{formatCreditsWithUSD(product.price_credits)}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setPromotingProduct(product)}
                    title="Promote listing"
                    className="p-1.5 rounded hover:bg-amber-50 text-gray-400 hover:text-amber-600"
                  >
                    <Megaphone className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setEditingProduct(product)}
                    title="Edit listing"
                    className="p-1.5 rounded hover:bg-indigo-50 text-gray-400 hover:text-indigo-600"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleToggleActive(product)}
                    disabled={toggling === product.id}
                    title={product.is_active ? 'Deactivate' : 'Activate'}
                    className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 disabled:opacity-50"
                  >
                    {product.is_active ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => setDeleteTarget({ id: product.id, title: product.title })}
                    disabled={deleting === product.id}
                    title="Delete listing"
                    className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateListingModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(p) => handleCreated(p as Product)}
        />
      )}
      {editingProduct && (
        <EditListingModal
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSaved={handleSaved}
        />
      )}
      {promotingProduct && (
        <PromoteModal
          product={promotingProduct}
          onClose={() => setPromotingProduct(null)}
        />
      )}

      {deleteTarget && (
        <ConfirmDeleteModal
          itemName={deleteTarget.title}
          onConfirm={() => confirmDelete(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
