'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  toId: string
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  label?: string
  fullWidth?: boolean
}

// Opens (or finds) a conversation with `toId` and navigates to it. Uses
// /api/messages/open so clicking does NOT insert a stub "Hi!" message —
// just creates the thread. Unauthenticated clicks bounce to /auth/login.
export function MessageButton({
  toId,
  variant = 'ghost',
  size = 'sm',
  label = 'Message',
  fullWidth = false,
}: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/messages/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to_id: toId }),
      })
      if (res.status === 401) {
        router.push('/auth/login')
        return
      }
      const body = await res.json()
      if (res.ok && body?.conversation_id) {
        router.push(`/messages/${body.conversation_id}`)
      } else {
        setError(body?.error ?? 'Could not open conversation')
      }
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={fullWidth ? 'w-full' : undefined}>
      <Button
        variant={variant}
        size={size}
        onClick={handleClick}
        disabled={loading}
        className={fullWidth ? 'w-full' : undefined}
      >
        <MessageSquare className="w-4 h-4 mr-1.5" />
        {loading ? 'Opening…' : label}
      </Button>
      {error && <p className="text-xs text-red-600 mt-1 text-center">{error}</p>}
    </div>
  )
}
