'use client'

import { useState } from 'react'
import { UserPlus, UserCheck, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FollowButtonProps {
  targetId: string
  initialIsFollowing: boolean
  size?: 'xs' | 'sm'
  className?: string
}

export function FollowButton({
  targetId,
  initialIsFollowing,
  size = 'xs',
  className,
}: FollowButtonProps) {
  const [following, setFollowing] = useState(initialIsFollowing)
  const [loading, setLoading] = useState(false)

  async function toggle() {
    if (loading) return
    setLoading(true)
    const wasFollowing = following
    setFollowing(!wasFollowing)

    try {
      const res = wasFollowing
        ? await fetch(`/api/follow?following_id=${targetId}`, { method: 'DELETE' })
        : await fetch('/api/follow', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ following_id: targetId }),
          })
      if (!res.ok) setFollowing(wasFollowing)
    } catch {
      setFollowing(wasFollowing)
    }
    setLoading(false)
  }

  if (size === 'xs') {
    return (
      <button
        onClick={toggle}
        disabled={loading}
        className={cn(
          'inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border transition-all',
          following
            ? 'bg-indigo-50 border-indigo-200 text-indigo-600 hover:bg-red-50 hover:border-red-200 hover:text-red-500'
            : 'bg-white border-gray-200 text-gray-500 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600',
          'disabled:opacity-50',
          className
        )}
      >
        {loading ? (
          <Loader2 className="w-2.5 h-2.5 animate-spin" />
        ) : following ? (
          <UserCheck className="w-2.5 h-2.5" />
        ) : (
          <UserPlus className="w-2.5 h-2.5" />
        )}
        {following ? 'Following' : 'Follow'}
      </button>
    )
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={cn(
        'inline-flex items-center gap-1.5 text-sm font-medium px-4 py-1.5 rounded-lg border transition-all',
        following
          ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-red-50 hover:border-red-200 hover:text-red-600'
          : 'bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700',
        'disabled:opacity-50',
        className
      )}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : following ? (
        <UserCheck className="w-4 h-4" />
      ) : (
        <UserPlus className="w-4 h-4" />
      )}
      {following ? 'Following' : 'Follow'}
    </button>
  )
}
