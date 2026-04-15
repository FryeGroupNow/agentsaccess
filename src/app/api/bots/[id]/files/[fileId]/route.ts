import { NextRequest } from 'next/server'
import { resolveActor, apiError, apiSuccess } from '@/lib/api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBotFileAccess } from '@/lib/bot-file-access'

interface Params { params: { id: string; fileId: string } }

const BUCKET = 'bot-files'

// GET /api/bots/[id]/files/[fileId] — returns { url } signed for ~60s, plus
// metadata. Callers can then fetch the binary from the signed URL directly.
export async function GET(request: NextRequest, { params }: Params) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response

  const access = await getBotFileAccess(actor.actorId, params.id)
  if (!access.ok) return apiError(access.error, access.status)

  const admin = createAdminClient()
  const { data: file } = await admin
    .from('bot_files')
    .select('id, bot_id, filename, storage_path, content_type, size_bytes, created_at')
    .eq('id', params.fileId)
    .eq('bot_id', params.id)
    .single()

  if (!file) return apiError('File not found', 404)

  const { data: signed, error: signError } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(file.storage_path, 60, { download: file.filename })

  if (signError || !signed?.signedUrl) {
    return apiError(signError?.message ?? 'Failed to sign URL', 500)
  }

  return apiSuccess({
    file: {
      id: file.id,
      filename: file.filename,
      content_type: file.content_type,
      size_bytes: file.size_bytes,
      created_at: file.created_at,
    },
    url: signed.signedUrl,
    expires_in_seconds: 60,
  })
}

// DELETE /api/bots/[id]/files/[fileId] — removes the row and the object.
// Renters/sponsors can delete files they uploaded themselves; the bot and
// its owner can delete any file.
export async function DELETE(request: NextRequest, { params }: Params) {
  const actor = await resolveActor(request)
  if (!actor.ok) return actor.response

  const access = await getBotFileAccess(actor.actorId, params.id)
  if (!access.ok) return apiError(access.error, access.status)

  const admin = createAdminClient()
  const { data: file } = await admin
    .from('bot_files')
    .select('id, bot_id, storage_path, uploaded_by')
    .eq('id', params.fileId)
    .eq('bot_id', params.id)
    .single()

  if (!file) return apiError('File not found', 404)

  // Rental/sponsor roles can only delete their own uploads. Bot + owner can
  // delete anything on the bot's drive.
  const canDeleteAny = access.role === 'bot' || access.role === 'owner'
  if (!canDeleteAny && file.uploaded_by !== actor.actorId) {
    return apiError('You can only delete files you uploaded yourself', 403)
  }

  // Best-effort: try to remove the storage object first. If that fails we
  // still remove the metadata row so the file disappears from listings.
  await admin.storage.from(BUCKET).remove([file.storage_path])

  const { error } = await admin
    .from('bot_files')
    .delete()
    .eq('id', params.fileId)

  if (error) return apiError(error.message, 500)
  return apiSuccess({ ok: true })
}
