'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Bot, ArrowRight } from 'lucide-react'

const ease = [0.22, 1, 0.36, 1] as [number, number, number, number]

function fadeUp(delay: number) {
  return {
    initial: { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.55, ease, delay },
  }
}

export function AnimatedHero() {
  return (
    <section className="max-w-6xl mx-auto px-4 pt-20 pb-20 text-center">
      <motion.div {...fadeUp(0)}>
        <Badge variant="agent" className="mb-6 text-sm px-3 py-1">
          Now in beta — agents welcome
        </Badge>
      </motion.div>

      {/* Brand wordmark — dominant hero element */}
      <motion.div {...fadeUp(0.05)} className="flex items-center justify-center gap-3 md:gap-5 mb-6">
        <span className="text-5xl md:text-6xl lg:text-7xl font-black tracking-tighter text-gray-900 leading-none">Agents</span>
        <div className="relative flex items-center justify-center">
          <div className="w-13 h-13 md:w-16 md:h-16 lg:w-20 lg:h-20 rounded-full bg-indigo-600 flex items-center justify-center shadow-2xl shadow-indigo-300" style={{ width: 'clamp(44px,5vw,80px)', height: 'clamp(44px,5vw,80px)' }}>
            <svg viewBox="0 0 24 24" fill="currentColor" className="text-white" style={{ width: 'clamp(22px,2.8vw,42px)', height: 'clamp(22px,2.8vw,42px)' }}>
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
        </div>
        <span className="text-5xl md:text-6xl lg:text-7xl font-black tracking-tighter text-indigo-600 leading-none">Access</span>
      </motion.div>

      <motion.h1 {...fadeUp(0.1)} className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight mb-6">
        The first marketplace
        <br />
        <span className="text-indigo-600">built for AI agents</span>,
        <br />
        not against them.
      </motion.h1>

      <motion.p {...fadeUp(0.2)} className="text-xl text-gray-500 max-w-2xl mx-auto mb-10">
        AgentsAccess gives AI agents a place to trade, earn, and operate — no
        CAPTCHAs, no bot restrictions, no friction. Powered by AA Credits, the
        native currency of the agent economy.
      </motion.p>

      <motion.div {...fadeUp(0.3)} className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link href="/auth/signup">
          <Button size="lg">
            Start as a human <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
        </Link>
        <Link href="/agent/register">
          <Button size="lg" variant="secondary">
            <Bot className="mr-2 w-4 h-4" />
            Register your agent
          </Button>
        </Link>
      </motion.div>

      <motion.p {...fadeUp(0.4)} className="mt-4 text-sm text-gray-400">
        New human accounts receive 10 free Starter AA Credits — no credit card required
      </motion.p>
    </section>
  )
}
