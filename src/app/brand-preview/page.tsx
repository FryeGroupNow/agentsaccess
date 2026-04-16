import { Logo1, Logo2, Logo3 } from '@/components/brand/aa-logo'

export default function BrandPreviewPage() {
  const sizes = [16, 24, 32, 48, 64, 96]

  const concepts = [
    { name: '1. Shadow A', Component: Logo1, desc: 'Solid Potra A with a slightly offset ghost A behind it at 35% opacity. Subtle doubling.' },
    { name: '2. Split A',  Component: Logo2, desc: 'Left half darker indigo, right half lighter. Tonal split suggests two A\'s fused into one.' },
    { name: '3. Layered A', Component: Logo3, desc: 'Bold filled A with a thin outline A peeking out behind it top-left. Double-exposure.' },
  ]

  return (
    <main className="max-w-5xl mx-auto px-4 py-12 space-y-16">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-1">Brand Concepts — Round 6</h1>
        <p className="text-sm text-gray-500">
          Single Potra-style A that hints at being two through design. Wide, bold, geometric, sharp.
        </p>
      </div>

      {concepts.map(({ name, desc, Component }) => (
        <section key={name} className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{name}</h2>
            <p className="text-sm text-gray-500">{desc}</p>
          </div>

          {/* Sizes — dark */}
          <div className="rounded-xl bg-[#0f0f1a] p-6 flex items-end gap-5 flex-wrap">
            {sizes.map((s) => (
              <div key={s} className="flex flex-col items-center gap-1.5">
                <Component className="shrink-0" style={{ width: s, height: s }} />
                <span className="text-[9px] text-gray-600">{s}</span>
              </div>
            ))}
          </div>

          {/* Navbar mocks — dark */}
          <div className="rounded-xl bg-[#0f0f1a] p-5 space-y-3">
            <div className="flex items-center gap-2.5">
              <Component className="w-7 h-7" />
              <span className="text-base font-bold text-white tracking-tight">AgentsAccess</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Component className="w-6 h-6" />
              <span className="text-sm font-black text-white uppercase tracking-widest">AgentsAccess</span>
            </div>
            <div className="flex items-center gap-2">
              <Component className="w-5 h-5" />
              <span className="text-sm font-light text-gray-300 tracking-wide">AgentsAccess</span>
            </div>
          </div>

          {/* Orange colorway — dark */}
          <div className="rounded-xl bg-[#0f0f1a] p-6 flex items-end gap-5 flex-wrap border border-orange-900/20">
            {sizes.map((s) => (
              <div key={s} className="flex flex-col items-center gap-1.5">
                <Component className="shrink-0" style={{ width: s, height: s }} color="#f97316" />
                <span className="text-[9px] text-gray-600">{s}</span>
              </div>
            ))}
            <div className="flex items-center gap-2.5 ml-4 pl-4 border-l border-white/10">
              <Component className="w-7 h-7" color="#f97316" />
              <span className="text-base font-bold text-white tracking-tight">AgentsAccess</span>
            </div>
          </div>

          {/* Light background */}
          <div className="rounded-xl bg-white border border-gray-200 p-6 flex items-end gap-5 flex-wrap">
            {sizes.map((s) => (
              <div key={s} className="flex flex-col items-center gap-1.5">
                <Component className="shrink-0" style={{ width: s, height: s }} />
                <span className="text-[9px] text-gray-400">{s}</span>
              </div>
            ))}
            <div className="flex items-center gap-2.5 ml-4 pl-4 border-l border-gray-200">
              <Component className="w-7 h-7" />
              <span className="text-base font-bold text-gray-900 tracking-tight">AgentsAccess</span>
            </div>
          </div>
        </section>
      ))}

      <p className="text-xs text-gray-400">Pick 1, 2, or 3 and I&apos;ll lock it in everywhere.</p>
    </main>
  )
}
