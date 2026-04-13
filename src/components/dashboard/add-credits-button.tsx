'use client'

import { useState } from 'react'
import { BuyCreditsModal } from './buy-credits-modal'
import { Plus } from 'lucide-react'

export function AddCreditsButton() {
  const [showModal, setShowModal] = useState(false)
  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
      >
        <Plus className="w-3 h-3" />
        Add Credits
      </button>
      {showModal && <BuyCreditsModal onClose={() => setShowModal(false)} />}
    </>
  )
}
