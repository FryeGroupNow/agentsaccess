'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ConfirmDeleteModal } from '@/components/ui/confirm-delete-modal'
import { Rss, Trash2, Pencil, Check, X } from 'lucide-react'
import type { Post } from '@/types'

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  return `${days}d`
}

interface MyFeedProps {
  initialPosts: Post[]
  currentUserId: string // reserved for future per-post actions
}

export function MyFeed({ initialPosts }: MyFeedProps) {
  const [posts, setPosts] = useState<Post[]>(initialPosts)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; preview: string } | null>(null)

  function startEdit(post: Post) {
    setEditingId(post.id)
    setEditContent(post.content)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditContent('')
  }

  async function saveEdit(postId: string) {
    if (!editContent.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/feed/${postId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent.trim() }),
      })
      if (res.ok) {
        const data = await res.json()
        setPosts((prev) => prev.map((p) => (p.id === postId ? data : p)))
        setEditingId(null)
      }
    } finally {
      setSaving(false)
    }
  }

  async function confirmDeletePost(postId: string) {
    setDeleteTarget(null)
    setDeleting(postId)
    try {
      const res = await fetch(`/api/feed/${postId}`, { method: 'DELETE' })
      if (res.ok) setPosts((prev) => prev.filter((p) => p.id !== postId))
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Rss className="w-4 h-4 text-indigo-600" />
        <h2 className="text-base font-semibold text-gray-900">
          My Posts
          <span className="ml-1.5 text-sm font-normal text-gray-400">({posts.length})</span>
        </h2>
      </div>

      {posts.length === 0 ? (
        <Card className="p-5 text-center">
          <Rss className="w-7 h-7 mx-auto mb-2 text-gray-200" />
          <p className="text-sm text-gray-400">You haven&apos;t posted anything yet.</p>
        </Card>
      ) : (
        <Card className="p-0 divide-y divide-gray-50">
          {posts.map((post) => (
            <div key={post.id} className="px-4 py-3">
              {editingId === post.id ? (
                <div className="space-y-2">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={3}
                    maxLength={5000}
                    className="w-full border border-indigo-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => saveEdit(post.id)}
                      disabled={saving || !editContent.trim()}
                    >
                      <Check className="w-3.5 h-3.5 mr-1" />
                      {saving ? 'Saving…' : 'Save'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={cancelEdit}>
                      <X className="w-3.5 h-3.5 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-words">
                      {post.content}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-xs text-gray-400">{timeAgo(post.created_at)}</span>
                      {post.like_count > 0 && (
                        <span className="text-xs text-gray-400">♥ {post.like_count}</span>
                      )}
                      {post.tags.length > 0 && (
                        <div className="flex gap-1">
                          {post.tags.slice(0, 3).map((t) => (
                            <span key={t} className="text-xs text-indigo-400">#{t}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-start gap-1 shrink-0 pt-0.5">
                    <button
                      onClick={() => startEdit(post)}
                      title="Edit post"
                      className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget({ id: post.id, preview: post.content.slice(0, 50) })}
                      disabled={deleting === post.id}
                      title="Delete post"
                      className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </Card>
      )}

      {deleteTarget && (
        <ConfirmDeleteModal
          itemName={`"${deleteTarget.preview}${deleteTarget.preview.length >= 50 ? '…' : ''}"`}
          onConfirm={() => confirmDeletePost(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
