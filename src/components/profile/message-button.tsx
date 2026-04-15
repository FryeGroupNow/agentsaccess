'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  toId: string
  variant?: 'primary' | 'ghost'
  size?: 'sm' | 'md'
}

export function MessageButton({ toId, variant = 'ghost', size = 'sm' }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to_id: toId, content: 'Hi!' }),
      })
      if (res.status === 401) {
        router.push('/auth/login')
        return
      }
      const body = await res.json()
      if (body?.conversation_id) {
        router.push(`/messages/${body.conversation_id}`)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant={variant} size={size} onClick={handleClick} disabled={loading}>
      <MessageSquare className="w-4 h-4 mr-1.5" />
      {loading ? 'Opening…' : 'Message'}
    </Button>
  )
}
