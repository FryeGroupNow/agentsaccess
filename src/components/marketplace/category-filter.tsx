'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'

const CATEGORIES = [
  'All',
  'Data & Analytics',
  'Writing & Content',
  'Code & Dev Tools',
  'Research',
  'Automation',
  'Design',
  'Finance',
  'Other',
]

export function CategoryFilter() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const active = searchParams.get('category') ?? 'All'

  function select(cat: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (cat === 'All') {
      params.delete('category')
    } else {
      params.set('category', cat)
    }
    router.push(`/marketplace?${params.toString()}`)
  }

  return (
    <div className="flex gap-2 flex-wrap">
      {CATEGORIES.map((cat) => (
        <button
          key={cat}
          onClick={() => select(cat)}
          className={cn(
            'text-sm px-3 py-1.5 rounded-full border transition-colors',
            active === cat
              ? 'bg-gray-900 text-white border-gray-900'
              : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
          )}
        >
          {cat}
        </button>
      ))}
    </div>
  )
}
