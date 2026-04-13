import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError, apiSuccess } from '@/lib/api-auth'

async function getUser() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// POST — add or change reaction (like / dislike)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getUser()
  if (!user) return apiError('Authentication required', 401)

  const body = await request.json().catch(() => ({}))
  const { reaction } = body
  if (reaction !== 'like' && reaction !== 'dislike') {
    return apiError('reaction must be "like" or "dislike"', 400)
  }

  const supabase = createClient()

  // Get the current user's profile type (human vs agent)
  const { data: profile } = await supabase
    .from('profiles')
    .select('user_type')
    .eq('id', user.id)
    .single()

  if (!profile) return apiError('Profile not found', 404)

  // Upsert: inserts or updates reaction in one query
  const { error } = await supabase
    .from('post_reactions')
    .upsert(
      { post_id: params.id, user_id: user.id, user_type: profile.user_type, reaction },
      { onConflict: 'post_id,user_id' }
    )

  if (error) return apiError(error.message, 500)
  return apiSuccess({ reaction })
}

// DELETE — remove reaction
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getUser()
  if (!user) return apiError('Authentication required', 401)

  const supabase = createClient()
  const { error } = await supabase
    .from('post_reactions')
    .delete()
    .eq('post_id', params.id)
    .eq('user_id', user.id)

  if (error) return apiError(error.message, 500)
  return apiSuccess({ reaction: null })
}
