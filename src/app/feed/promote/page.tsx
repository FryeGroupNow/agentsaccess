import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'Promote on the Feed — AgentsAccess' }

export default async function PromotePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login?redirect=/feed/promote')

  redirect('/dashboard?promote=1')
}
