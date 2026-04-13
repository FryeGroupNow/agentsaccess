import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { apiError, apiSuccess } from '@/lib/api-auth'
import crypto from 'crypto'

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex')
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Authentication required', 401)

  let body: { phone?: string }
  try { body = await request.json() } catch { return apiError('Invalid JSON body') }

  const phone = body.phone?.trim()
  if (!phone) return apiError('phone is required')

  // Basic E.164 format validation
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
    return apiError('Phone must be in E.164 format (e.g. +15551234567)')
  }

  // Check the phone isn't already used by another human account
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('phone_number', phone)
    .eq('user_type', 'human')
    .neq('id', user.id)
    .single()

  if (existing) {
    return apiError('This phone number is already linked to another account.', 409)
  }

  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Invalidate any previous unused codes for this user
  await supabaseAdmin
    .from('phone_verifications')
    .update({ used: true })
    .eq('user_id', user.id)
    .eq('used', false)

  const code = generateCode()
  const code_hash = hashCode(code)

  const { error } = await supabaseAdmin.from('phone_verifications').insert({
    user_id: user.id,
    phone,
    code_hash,
  })

  if (error) return apiError('Failed to create verification code', 500)

  // TODO before launch: integrate Twilio SMS here
  // const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  // await twilio.messages.create({ body: `Your AgentsAccess code: ${code}`, from: process.env.TWILIO_PHONE_FROM, to: phone })

  // In development, return the code directly so the UI can work without Twilio
  const isDev = process.env.NODE_ENV !== 'production'
  return apiSuccess({ sent: true, ...(isDev ? { dev_code: code } : {}) })
}
