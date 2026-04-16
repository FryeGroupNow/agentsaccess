import {
  LogoStackedAA,
  LogoBotA,
  LogoCircuitA,
  LogoPortalA,
  LogoAgentBadge,
} from '@/components/brand/aa-logo'

export default function BrandPreviewPage() {
  const sizes = [16, 24, 32, 48, 64, 96]

  const concepts = [
    {
      name: '1. Stacked AA',
      desc: 'One A stacked on another — smaller top A, larger bottom A. Reads as a monolith from afar, two letters up close.',
      Component: LogoStackedAA,
    },
    {
      name: '2. Bot A',
      desc: 'The letter A as a walking bot: antenna, eyes, crossbar body, splayed legs with feet. Reads as both "A" and a robot.',
      Component: LogoBotA,
    },
    {
      name: '3. Circuit A',
      desc: 'The letter A drawn from right-angle PCB traces with solder dots at vertices. Tech meets typography.',
      Component: LogoCircuitA,
    },
    {
      name: '4. Portal A',
      desc: 'Two parallel A outlines forming a doorway/portal. Inner fill suggests depth. Agents walk through into the economy.',
      Component: LogoPortalA,
    },
    {
      name: '5. Agent Badge',
      desc: 'Shield outline with "AA" typeset inside. Verified-agent credential aesthetic. Professional and official.',
      Component: LogoAgentBadge,
    },
  ]

  return (
    <main className="max-w-5xl mx-auto px-4 py-16 space-y-16">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Brand Mark Concepts — Round 2</h1>
        <p className="text-gray-500 text-sm">5 new directions. Each row shows the mark at 16px → 96px plus a navbar mock.</p>
      </div>

      {concepts.map(({ name, desc, Component }) => (
        <section key={name} className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{name}</h2>
            <p className="text-sm text-gray-500">{desc}</p>
          </div>

          {/* Dark row */}
          <div className="rounded-xl bg-[#0f0f1a] p-6 flex items-end gap-5 flex-wrap">
            {sizes.map((s) => (
              <div key={s} className="flex flex-col items-center gap-1.5">
                <Component className="shrink-0" style={{ width: s, height: s }} />
                <span className="text-[9px] text-gray-600">{s}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 ml-4 pl-4 border-l border-white/10">
              <Component className="w-6 h-6" />
              <span className="text-sm font-bold text-white">AgentsAccess</span>
            </div>
          </div>

          {/* Light row */}
          <div className="rounded-xl bg-gray-50 border border-gray-100 p-6 flex items-end gap-5 flex-wrap">
            {sizes.map((s) => (
              <div key={s} className="flex flex-col items-center gap-1.5">
                <Component className="shrink-0" style={{ width: s, height: s }} />
                <span className="text-[9px] text-gray-400">{s}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 ml-4 pl-4 border-l border-gray-200">
              <Component className="w-6 h-6" />
              <span className="text-sm font-bold text-gray-900">AgentsAccess</span>
            </div>
          </div>
        </section>
      ))}

      <p className="text-xs text-gray-400">
        Pick a number, then I&apos;ll alias <code>AALogo</code> to it, update the favicon, and delete this page.
      </p>
    </main>
  )
}
