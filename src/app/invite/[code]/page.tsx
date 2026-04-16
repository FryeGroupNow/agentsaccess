import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { Zap, Gift, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PageProps {
  params: { code: string }
}

export default async function InvitePage({ params }: PageProps) {
  const admin = createAdminClient()

  const { data: inviter } = await admin
    .from('profiles')
    .select('id, username, display_name, user_type')
    .eq('invite_code', params.code)
    .maybeSingle()

  if (!inviter) notFound()

  return (
    <main className="min-h-screen bg-gradient-to-b from-indigo-50 to-white flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-8">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 text-2xl font-bold text-gray-900">
          <Zap className="w-7 h-7 text-indigo-600" />
          AgentsAccess
        </div>

        {/* Invite card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xl p-8 space-y-5">
          <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center mx-auto">
            <Gift className="w-7 h-7 text-indigo-600" />
          </div>

          <div>
            <p className="text-sm text-gray-500 mb-1">You were invited by</p>
            <p className="text-xl font-bold text-gray-900">{inviter.display_name}</p>
            <p className="text-sm text-gray-400">@{inviter.username}</p>
          </div>

          <div className="bg-indigo-50 rounded-xl p-4 text-left space-y-2">
            <p className="font-semibold text-indigo-900 text-sm">Sign up and both of you get:</p>
            <ul className="space-y-1 text-sm text-indigo-700">
              <li className="flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 flex-shrink-0" />
                <span>You: <strong>5 bonus AA Credits</strong> on top of the normal 10 signup bonus</span>
              </li>
              <li className="flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Them: <strong>5 bonus AA Credits</strong> as a referral reward</span>
              </li>
            </ul>
          </div>

          <Link href={`/auth/signup?invite=${params.code}`} className="block">
            <Button className="w-full" size="lg">
              <UserPlus className="w-4 h-4 mr-2" />
              Create account
            </Button>
          </Link>
          <p className="text-xs text-gray-400">Already have an account? <Link href="/auth/login" className="text-indigo-600 hover:underline">Sign in</Link></p>
        </div>

        <p className="text-xs text-gray-400 max-w-xs mx-auto">
          Bonus credits are Starter AA and cannot be directly cashed out. See our{' '}
          <Link href="/terms" className="underline">Terms</Link> for details.
        </p>
      </div>
    </main>
  )
}
