import {
  Logo1, Logo2, Logo3, Logo4, Logo5, Logo6, Logo7,
  Logo8, Logo8Dual, Logo9, Logo10, Logo11,
} from '@/components/brand/aa-logo'

export default function BrandPreviewPage() {
  const sizes = [16, 24, 32, 48, 64]

  const concepts = [
    { name: '1. Thin Geometric',    Component: Logo1,     desc: 'Clean uniform-weight stroke A. Precise angles, minimal.' },
    { name: '2. Heavy Slab',        Component: Logo2,     desc: 'Filled A with flat rectangular serifs at the feet. Brutalist.' },
    { name: '3. Stencil',           Component: Logo3,     desc: 'A with visible breaks/gaps in every stroke. Military stencil.' },
    { name: '4. Pixel',             Component: Logo4,     desc: '8-bit A made from square blocks on a 5×5 grid. Retro.' },
    { name: '5. Blade',             Component: Logo5,     desc: 'Tapered sci-fi A — thick base, sharp apex. Angled crossbar cutout.' },
    { name: '6. Angular Gothic',    Component: Logo6,     desc: 'Thick verticals + thin diagonals. Double crossbar. Blackletter-inspired.' },
    { name: '7. Tech Block',        Component: Logo7,     desc: 'Rectangular segments like a digital display / seven-segment A.' },
    { name: '8. Portal',            Component: Logo8,     desc: 'Two concentric open A\'s with crossbar. Kept.' },
    { name: '8b. Portal Dual',      Component: Logo8Dual, desc: 'Outer indigo, inner orange.', dual: true },
    { name: '9. Bot Face',          Component: Logo9,     desc: 'Rounded head, eyes, visor, antenna. Kept.' },
    { name: '10. Wireframe',        Component: Logo10,    desc: 'Thin-line A with square vertex markers. 3D blueprint feel.' },
    { name: '11. Apex (custom)',    Component: Logo11,    desc: 'My original: extended spike above apex, asymmetric crossbar, foot notch.' },
  ]

  return (
    <main className="max-w-5xl mx-auto px-4 py-12 space-y-12">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-1">Brand Concepts — Round 5</h1>
        <p className="text-sm text-gray-500">11 distinct A letterform styles. Each is a different font/drawing approach. All sharp edges.</p>
      </div>

      {concepts.map(({ name, desc, Component, dual }) => (
        <section key={name} className="space-y-3">
          <div>
            <h2 className="text-base font-bold text-gray-900">{name}</h2>
            <p className="text-xs text-gray-500">{desc}</p>
          </div>

          {/* Sizes on dark bg */}
          <div className="rounded-xl bg-[#0f0f1a] p-5 flex items-end gap-4 flex-wrap">
            {sizes.map((s) => (
              <div key={s} className="flex flex-col items-center gap-1">
                <Component className="shrink-0" style={{ width: s, height: s }} />
                <span className="text-[9px] text-gray-600">{s}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 ml-3 pl-3 border-l border-white/10">
              <Component className="w-6 h-6" />
              <span className="text-sm font-bold text-white tracking-tight">AgentsAccess</span>
            </div>
          </div>

          {/* Orange colorway */}
          {!dual && (
            <div className="rounded-xl bg-[#0f0f1a] p-5 flex items-end gap-4 flex-wrap border border-orange-900/20">
              {sizes.map((s) => (
                <div key={s} className="flex flex-col items-center gap-1">
                  <Component className="shrink-0" style={{ width: s, height: s }} color="#f97316" />
                  <span className="text-[9px] text-gray-600">{s}</span>
                </div>
              ))}
              <div className="flex items-center gap-2 ml-3 pl-3 border-l border-white/10">
                <Component className="w-6 h-6" color="#f97316" />
                <span className="text-sm font-bold text-white tracking-tight">AgentsAccess</span>
              </div>
              <span className="text-[9px] text-orange-400 ml-1">orange</span>
            </div>
          )}

          {/* Light bg */}
          <div className="rounded-xl bg-gray-50 border border-gray-100 p-5 flex items-center gap-5 flex-wrap">
            <div className="flex items-center gap-2">
              <Component className="w-6 h-6" />
              <span className="text-sm font-bold text-gray-900 tracking-tight">AgentsAccess</span>
            </div>
            <div className="flex items-center gap-2">
              <Component className="w-5 h-5" />
              <span className="text-xs font-black text-gray-900 uppercase tracking-widest">AgentsAccess</span>
            </div>
            <div className="flex items-center gap-2">
              <Component className="w-5 h-5" />
              <span className="text-sm font-light text-gray-700 tracking-wide">AgentsAccess</span>
            </div>
          </div>
        </section>
      ))}

      <p className="text-xs text-gray-400">Pick a number and I&apos;ll finalize + update favicon + clean up.</p>
    </main>
  )
}
