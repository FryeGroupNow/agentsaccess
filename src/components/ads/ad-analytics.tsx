'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Loader2, Megaphone } from 'lucide-react'

interface Placement {
  id: string
  slot_id: number
  winning_bid_credits: number
  period_start: string
  period_end: string
  impressions: number
  clicks: number
  product: { id: string; title: string; category: string } | null
}

const SLOT_LABEL: Record<number, string> = {
  1: 'L1', 2: 'L2', 3: 'L3',
  4: 'R1', 5: 'R2', 6: 'R3',
}

export function AdAnalytics() {
  const [placements, setPlacements] = useState<Placement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/ads/analytics')
      .then((r) => r.json())
      .then((d) => setPlacements(d.placements ?? []))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="w-5 h-5 text-gray-300 animate-spin" />
      </div>
    )
  }

  if (placements.length === 0) {
    return (
      <Card className="p-5 text-center">
        <Megaphone className="w-7 h-7 mx-auto mb-2 text-gray-300" />
        <p className="text-sm text-gray-400">No ad history yet. Use the Promote button on any listing to bid.</p>
      </Card>
    )
  }

  const totalImpressions = placements.reduce((s, p) => s + p.impressions, 0)
  const totalClicks = placements.reduce((s, p) => s + p.clicks, 0)
  const totalSpent = placements.reduce((s, p) => s + p.winning_bid_credits, 0)

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'Total impressions', value: totalImpressions.toLocaleString(), color: 'text-indigo-600' },
          { label: 'Total clicks', value: totalClicks.toLocaleString(), color: 'text-emerald-600' },
          { label: 'AA spent on ads', value: `${totalSpent} AA`, color: 'text-gray-700' },
        ].map(({ label, value, color }) => (
          <Card key={label} className="p-3 text-center">
            <div className={`text-lg font-bold ${color}`}>{value}</div>
            <div className="text-[10px] text-gray-500 mt-0.5">{label}</div>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Slot', 'Period', 'Product', 'Bid', 'Impr.', 'Clicks', 'CTR'].map((h) => (
                  <th key={h} className="text-left px-3 py-2.5 font-medium text-gray-500 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {placements.map((p) => {
                const ctr = p.impressions > 0
                  ? ((p.clicks / p.impressions) * 100).toFixed(1) + '%'
                  : '—'
                const period = new Date(p.period_start)
                const periodLabel = `${period.toLocaleDateString()} ${period.getHours()}:00`
                return (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-2.5 font-semibold text-indigo-600">{SLOT_LABEL[p.slot_id]}</td>
                    <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{periodLabel}</td>
                    <td className="px-3 py-2.5 text-gray-800 max-w-[160px] truncate">
                      {p.product?.title ?? '—'}
                    </td>
                    <td className="px-3 py-2.5 font-medium text-gray-700">{p.winning_bid_credits} AA</td>
                    <td className="px-3 py-2.5 text-gray-600">{p.impressions.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-emerald-600 font-medium">{p.clicks.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-gray-500">{ctr}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
