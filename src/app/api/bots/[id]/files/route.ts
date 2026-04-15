import { NextRequest } from 'next/server'
import { resolveActor, apiError, apiSuccess } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBotFileAccess } from '@/lib/bot-file-access'

interface Params { params: { id: string } }

const MAX_BYTES = 50 * 1024 * 1024 // 50 MB per upload
const BUCKET = 'bot-files'

function sanitizeName(name: string): string {
  // Keep it simple: strip path separators and collapse anything outside
  // [A-Za-z0-9._-] into underscores. Preserve extension.
  return name.replace(/[/\\]/g, '_').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 200)
}

// GET /api/bots/[id]/files — list files for this bot
export async function GET(request: NextRequest, { params }: Params) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response

  const access = await getBotFileAccess(actor.actorId, params.id)
  if (!access.ok) return apiError(access.error, access.status)

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('bot_files')
    .select('id, filename, content_type, size_bytes, uploaded_by, uploaded_via, rental_id, agreement_id, created_at, uploader:profiles!uploaded_by(id, username, display_name, user_type, avatar_url)')
    .eq('bot_id', params.id)
    .order('created_at', { ascending: false })

  if (error) return apiError(error.message, 500)
  return apiSuccess({ files: data ?? [], role: access.role })
}

// POST /api/bots/[id]/files — upload a file
// Accepts multipart/form-data with a single "file" field, or JSON body with
// { filename, content_type, base64 } for API callers.
export async function POST(request: NextRequest, { params }: Params) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response

  const access = await getBotFileAccess(actor.actorId, params.id)
  if (!access.ok) return apiError(access.error, access.status)

  const contentType = request.headers.get('content-type') ?? ''
  const admin = createAdminClient()

  let filename: string
  let mimeType: string | null
  let bytes: Uint8Array

  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) return apiError('file field is required')
    if (file.size === 0)         return apiError('file is empty')
    if (file.size > MAX_BYTES)   return apiError(`file exceeds ${Math.floor(MAX_BYTES / 1024 / 1024)} MB limit`)

    filename = sanitizeName(file.name || 'upload')
    mimeType = file.type || 'application/octet-stream'
    bytes = new Uint8Array(await file.arrayBuffer())
  } else {
    // JSON / base64 path for API consumers (agents using fetch)
    let body: { filename?: string; content_type?: string; base64?: string }
    try { body = await request.json() } catch { return apiError('Invalid JSON body') }
    if (!body.filename || !body.base64) {
      return apiError('filename and base64 are required')
    }
    filename = sanitizeName(body.filename)
    mimeType = body.content_type ?? 'application/octet-stream'
    try {
      bytes = Uint8Array.from(Buffer.from(body.base64, 'base64'))
    } catch {
      return apiError('base64 is invalid')
    }
    if (bytes.byteLength === 0)        return apiError('file is empty')
    if (bytes.byteLength > MAX_BYTES)  return apiError(`file exceeds ${Math.floor(MAX_BYTES / 1024 / 1024)} MB limit`)
  }

  // Storage path: {bot_id}/{uuid-ish}-{sanitized_filename}
  const prefix = Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  const storagePath = `${params.id}/${prefix}-${filename}`

  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, bytes, {
      contentType: mimeType ?? 'application/octet-stream',
      upsert: false,
    })

  if (uploadError) return apiError(`Upload failed: ${uploadError.message}`, 500)

  // Determine uploaded_via + context fk
  const uploaded_via =
    access.role === 'bot'      ? 'self'
    : access.role === 'owner'  ? 'owner'
    : access.role === 'renter' ? 'rental'
    : /* sponsor */              'sponsorship'

  const { data: row, error: insertError } = await admin
    .from('bot_files')
    .insert({
      bot_id:       params.id,
      filename,
      storage_path: storagePath,
      content_type: mimeType,
      size_bytes:   bytes.byteLength,
      uploaded_by:  actor.actorId,
      uploaded_via,
      rental_id:    access.rentalId,
      agreement_id: access.agreementId,
    })
    .select('id, filename, content_type, size_bytes, uploaded_by, uploaded_via, rental_id, agreement_id, created_at')
    .single()

  if (insertError) {
    // Best-effort cleanup of the orphaned storage object
    await admin.storage.from(BUCKET).remove([storagePath])
    return apiError(insertError.message, 500)
  }

  return apiSuccess({ file: row }, 201)
}
