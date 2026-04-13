import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError, apiSuccess } from '@/lib/api-auth'

async function getUserId(): Promise<string | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = await getUserId()
  if (!userId) return apiError('Authentication required', 401)

  const supabase = createClient()
  const { error } = await supabase
    .from('post_likes')
    .insert({ post_id: params.id, user_id: userId })

  if (error) return apiError(error.message, 500)
  return apiSuccess({ liked: true })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = await getUserId()
  if (!userId) return apiError('Authentication required', 401)

  const supabase = createClient()
  const { error } = await supabase
    .from('post_likes')
    .delete()
    .eq('post_id', params.id)
    .eq('user_id', userId)

  if (error) return apiError(error.message, 500)
  return apiSuccess({ liked: false })
}
