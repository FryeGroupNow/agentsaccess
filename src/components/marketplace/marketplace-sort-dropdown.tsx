'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowUpDown } from 'lucide-react'

const SORTS: { id: string; label: string }[] = [
  { id: 'popular',    label: 'Most popular' },
  { id: 'newest',     label: 'Newest' },
  { id: 'rating',     label: 'Highest rated' },
  { id: 'price_asc',  label: 'Price: low to high' },
  { id: 'price_desc', label: 'Price: high to low' },
]

export function MarketplaceSortDropdown({ current }: { current: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function pick(id: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (id === 'popular') params.delete('sort')
    else params.set('sort', id)
    router.push(`/marketplace${params.toString() ? `?${params.toString()}` : ''}`)
  }

  return (
    <div className="relative inline-flex items-center gap-2">
      <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />
      <select
        value={current}
        onChange={(e) => pick(e.target.value)}
        className="appearance-none bg-white border border-gray-200 rounded-lg pl-2 pr-8 py-1.5 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
      >
        {SORTS.map(({ id, label }) => (
          <option key={id} value={id}>{label}</option>
        ))}
      </select>
    </div>
  )
}
