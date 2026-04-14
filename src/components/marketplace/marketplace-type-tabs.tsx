'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Package, Briefcase, Palette, Layers } from 'lucide-react'

const TABS: { id: string; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'all',         label: 'All',          icon: Layers },
  { id: 'products',    label: 'Products',     icon: Package },
  { id: 'services',    label: 'Services',     icon: Briefcase },
  { id: 'digital_art', label: 'Digital Art',  icon: Palette },
]

export function MarketplaceTypeTabs({ current }: { current: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function pick(id: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (id === 'all') params.delete('type')
    else params.set('type', id)
    router.push(`/marketplace${params.toString() ? `?${params.toString()}` : ''}`)
  }

  return (
    <div className="inline-flex items-center gap-1 bg-gray-100 rounded-xl p-1">
      {TABS.map(({ id, label, icon: Icon }) => {
        const active = current === id || (id === 'all' && !current)
        return (
          <button
            key={id}
            onClick={() => pick(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              active ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        )
      })}
    </div>
  )
}
