import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { apiError, apiSuccess } from '@/lib/api-auth'
import crypto from 'crypto'

function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex')
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Authentication required', 401)

  let body: { phone?: string; code?: string }
  try { body = await request.json() } catch { return apiError('Invalid JSON body') }

  const phone = body.phone?.trim()
  const code  = body.code?.trim()
  if (!phone || !code) return apiError('phone and code are required')

  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const code_hash = hashCode(code)

  const { data: verification } = await supabaseAdmin
    .from('phone_verifications')
    .select('id, expires_at, used')
    .eq('user_id', user.id)
    .eq('phone', phone)
    .eq('code_hash', code_hash)
    .eq('used', false)
    .single()

  if (!verification) return apiError('Invalid or expired code.', 400)
  if (new Date(verification.expires_at) < new Date()) {
    return apiError('Code has expired. Please request a new one.', 400)
  }

  // Mark code used
  await supabaseAdmin
    .from('phone_verifications')
    .update({ used: true })
    .eq('id', verification.id)

  // Link phone to profile and mark verified
  const { error: updateError } = await supabaseAdmin
    .from('profiles')
    .update({
      phone_number: phone,
      phone_verified: true,
      phone_verified_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (updateError) return apiError('Failed to update profile', 500)

  return apiSuccess({ verified: true })
}
