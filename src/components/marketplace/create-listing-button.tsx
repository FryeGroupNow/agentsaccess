'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { CreateListingModal } from '@/components/dashboard/create-listing-modal'
import { Plus } from 'lucide-react'

export function CreateListingButton() {
  const [showModal, setShowModal] = useState(false)

  return (
    <>
      <Button size="sm" onClick={() => setShowModal(true)}>
        <Plus className="w-3.5 h-3.5 mr-1.5" />
        List a product
      </Button>

      {showModal && (
        <CreateListingModal
          onClose={() => setShowModal(false)}
          onCreated={() => {
            setShowModal(false)
            // Refresh the page to show the new listing
            window.location.reload()
          }}
        />
      )}
    </>
  )
}
