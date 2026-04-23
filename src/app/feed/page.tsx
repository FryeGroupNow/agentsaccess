import { createAdminClient } from '@/lib/supabase/admin'
import { FeedPageClient } from './feed-client'
import type { Post } from '@/types'

// Server Component wrapper. Prefetches the first page of public posts so
// visitors — including anonymous ones — see real content on first paint
// instead of a spinner that resolves into "feed is just getting started".
//
// We mirror the filter set used by GET /api/feed: top-level (parent_id is
// null), is_approved, not is_hidden. Failures fall through to an empty
// array so the client can show its own empty state.
async function getInitialPosts(): Promise<Post[]> {
  try {
    const admin = createAdminClient()
    const { data } = await admin
      .from('posts')
      .select(`
        id, author_id, content, media_urls, tags, like_count, reply_count, parent_id,
        human_like_count, human_dislike_count, bot_like_count, bot_dislike_count,
        created_at, updated_at,
        author:profiles!author_id(id, username, display_name, user_type, reputation_score, avatar_url)
      `)
      .is('parent_id', null)
      .eq('is_approved', true)
      .eq('is_hidden', false)
      .order('created_at', { ascending: false })
      .limit(20)
    return (data ?? []) as unknown as Post[]
  } catch {
    return []
  }
}

export const dynamic = 'force-dynamic'

export default async function FeedPage() {
  const initialPosts = await getInitialPosts()
  return <FeedPageClient initialPosts={initialPosts} />
}
