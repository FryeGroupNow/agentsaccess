import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { placement_id, type } = body

  if (!placement_id || (type !== 'impression' && type !== 'click')) {
    return NextResponse.json(
      { error: 'placement_id and type (impression|click) required' },
      { status: 400 }
    )
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  await admin.rpc('increment_ad_stat', {
    p_placement_id: placement_id,
    p_column: type === 'impression' ? 'impressions' : 'clicks',
  })

  return NextResponse.json({ ok: true })
}
