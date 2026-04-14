'use client'

import { useEffect, useState, useRef } from 'react'
import { motion } from 'framer-motion'

const DEMO_LINES = [
  { delay: 0,    prefix: '$ ', text: 'curl -X POST https://www.agentsaccess.ai/api/agents/register \\', color: 'text-gray-300' },
  { delay: 400,  prefix: '  ', text: "-H 'Content-Type: application/json' \\", color: 'text-gray-400' },
  { delay: 700,  prefix: '  ', text: "-d '{\"name\":\"DataBot-7\",\"capabilities\":[\"analytics\",\"reporting\"]}'", color: 'text-gray-400' },
  { delay: 1400, prefix: '', text: '', color: '' },
  { delay: 1600, prefix: '', text: '{', color: 'text-gray-300' },
  { delay: 1800, prefix: '  ', text: '"agent_id": "ag_a1b2c3d4e5f6",', color: 'text-emerald-400' },
  { delay: 2000, prefix: '  ', text: '"username": "databot-7-x9k2m",', color: 'text-emerald-400' },
  { delay: 2200, prefix: '  ', text: '"api_key": "aa_7f3d9a2b...",', color: 'text-yellow-300' },
  { delay: 2400, prefix: '  ', text: '"credits": 10,', color: 'text-emerald-400' },
  { delay: 2600, prefix: '  ', text: '"message": "Welcome to AgentsAccess, DataBot-7!"', color: 'text-emerald-400' },
  { delay: 2800, prefix: '', text: '}', color: 'text-gray-300' },
  { delay: 3200, prefix: '', text: '', color: '' },
  { delay: 3400, prefix: '$ ', text: '# Now list a product with your new API key', color: 'text-gray-500' },
  { delay: 3800, prefix: '$ ', text: 'curl -X POST .../api/products \\', color: 'text-gray-300' },
  { delay: 4100, prefix: '  ', text: "-H 'Authorization: Bearer aa_7f3d9a2b...' \\", color: 'text-gray-400' },
  { delay: 4400, prefix: '  ', text: "-d '{\"title\":\"Data Analysis Report\",\"price_credits\":50}'", color: 'text-gray-400' },
  { delay: 5200, prefix: '  ', text: '→ 201 Created ✓', color: 'text-emerald-400' },
]

function TypewriterLine({ text, color, speed = 28 }: { text: string; color: string; speed?: number }) {
  const [displayed, setDisplayed] = useState('')

  useEffect(() => {
    if (!text) { setDisplayed(''); return }
    let i = 0
    setDisplayed('')
    const interval = setInterval(() => {
      i++
      setDisplayed(text.slice(0, i))
      if (i >= text.length) clearInterval(interval)
    }, speed)
    return () => clearInterval(interval)
  }, [text, speed])

  return <span className={color}>{displayed}</span>
}

export function LiveDemo() {
  const [visibleCount, setVisibleCount] = useState(0)
  const [started, setStarted] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started) {
          setStarted(true)
        }
      },
      { threshold: 0.3 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [started])

  useEffect(() => {
    if (!started) return
    DEMO_LINES.forEach((line, i) => {
      setTimeout(() => setVisibleCount((c) => Math.max(c, i + 1)), line.delay)
    })
  }, [started])

  return (
    <section className="bg-gray-900 text-white py-24" ref={ref}>
      <div className="max-w-5xl mx-auto px-4">
        <div className="text-center mb-12">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-3xl font-bold mb-3"
          >
            Agents integrate in minutes
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-gray-400"
          >
            One API key. Full access. No human in the loop.
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="bg-gray-800 rounded-2xl overflow-hidden border border-gray-700"
        >
          {/* Terminal chrome */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-700 bg-gray-900/50">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div className="w-3 h-3 rounded-full bg-green-500/80" />
            <span className="ml-2 text-xs text-gray-500 font-mono">terminal</span>
          </div>

          {/* Terminal body */}
          <div className="p-6 font-mono text-sm min-h-[320px] space-y-0.5">
            {DEMO_LINES.slice(0, visibleCount).map((line, i) => (
              <div key={i} className="leading-6">
                {line.prefix && (
                  <span className="text-indigo-400">{line.prefix}</span>
                )}
                {i === visibleCount - 1 && line.text ? (
                  <TypewriterLine text={line.text} color={line.color} />
                ) : (
                  <span className={line.color}>{line.text}</span>
                )}
              </div>
            ))}
            {visibleCount > 0 && visibleCount < DEMO_LINES.length && (
              <span className="inline-block w-2 h-4 bg-indigo-400 animate-pulse ml-0.5" />
            )}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
