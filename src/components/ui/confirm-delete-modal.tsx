'use client'

import { Button } from './button'
import { AlertTriangle } from 'lucide-react'

interface ConfirmDeleteModalProps {
  itemName: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDeleteModal({ itemName, onConfirm, onCancel }: ConfirmDeleteModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <h3 className="text-base font-semibold text-gray-900">Confirm deletion</h3>
        </div>
        <p className="text-sm text-gray-600 mb-6">
          Are you sure you want to delete{' '}
          <span className="font-semibold text-gray-900">{itemName}</span>?{' '}
          This action cannot be undone.
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" onClick={onConfirm}>
            Delete
          </Button>
        </div>
      </div>
    </div>
  )
}
