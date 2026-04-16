import {
  Logo1, Logo2, Logo3, Logo4, Logo5, Logo6, Logo7,
  Logo8, Logo8Dual, Logo9, Logo10, Logo11,
} from '@/components/brand/aa-logo'

const FONTS = [
  { label: 'Bold Sans',    cls: 'font-bold tracking-tight' },
  { label: 'Black Caps',   cls: 'font-black uppercase tracking-widest text-[13px]' },
  { label: 'Light',        cls: 'font-light tracking-wide' },
  { label: 'Mono',         cls: 'font-semibold font-mono tracking-tight' },
  { label: 'Condensed',    cls: 'font-extrabold tracking-tighter' },
]

export default function BrandPreviewPage() {
  const sizes = [16, 24, 32, 48, 64]

  const concepts = [
    { name: '1. Split A',          Component: Logo1,     desc: 'Single A split by a vertical gap — reads as two A halves.' },
    { name: '2. Shadow A',         Component: Logo2,     desc: 'Single A with an offset echo behind it. Doubled impression.' },
    { name: '3. Notch A',          Component: Logo3,     desc: 'Single A with V-notch apex — twin peaks read as AA.' },
    { name: '4. Double-Bar A',     Component: Logo4,     desc: 'Single A with two stacked crossbars implying two letters.' },
    { name: '5. Filled Split A',   Component: Logo5,     desc: 'Bold filled A bisected by a dark vertical line.' },
    { name: '6. Stencil A',        Component: Logo6,     desc: 'Filled A cut into left/right halves with gap. Industrial.' },
    { name: '7. Slash A',          Component: Logo7,     desc: 'A with a diagonal slash cutting across it.' },
    { name: '8. Portal A',         Component: Logo8,     desc: 'Two concentric open A\'s with crossbar. Clean portal.' },
    { name: '8b. Portal Dual',     Component: Logo8Dual, desc: 'Outer A indigo, inner A orange.', dual: true },
    { name: '9. Bot Face',         Component: Logo9,     desc: 'Rounded head, eyes, visor, antenna. Minimal agent.' },
    { name: '10. Monogram Ring',   Component: Logo10,    desc: 'AA inside a circle. Corporate, clean.' },
    { name: '11. Notch A Dual',    Component: Logo11,    desc: 'Notch A with left peak indigo, right peak orange.', dual: true },
  ]

  return (
    <main className="max-w-6xl mx-auto px-4 py-12 space-y-14">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-1">Brand Concepts — Round 4</h1>
        <p className="text-sm text-gray-500">Sharp edges, no rounded lines. Font pairings for each. Single-A-that-reads-as-AA variations: #1, 2, 3, 4, 5, 6, 7.</p>
      </div>

      {concepts.map(({ name, desc, Component, dual }) => (
        <section key={name} className="space-y-3">
          <div>
            <h2 className="text-base font-bold text-gray-900">{name}</h2>
            <p className="text-xs text-gray-500">{desc}</p>
          </div>

          {/* Sizes on dark */}
          <div className="rounded-xl bg-[#0f0f1a] p-5 flex items-end gap-4 flex-wrap">
            {sizes.map((s) => (
              <div key={s} className="flex flex-col items-center gap-1">
                <Component className="shrink-0" style={{ width: s, height: s }} />
                <span className="text-[9px] text-gray-600">{s}</span>
              </div>
            ))}
          </div>

          {/* Orange colorway (skip duals) */}
          {!dual && (
            <div className="rounded-xl bg-[#0f0f1a] p-5 flex items-end gap-4 flex-wrap border border-orange-900/20">
              {sizes.map((s) => (
                <div key={s} className="flex flex-col items-center gap-1">
                  <Component className="shrink-0" style={{ width: s, height: s }} color="#f97316" />
                  <span className="text-[9px] text-gray-600">{s}</span>
                </div>
              ))}
              <span className="text-[9px] text-orange-400 ml-1">orange</span>
            </div>
          )}

          {/* Font pairings — logo + wordmark in 5 font styles */}
          <div className="rounded-xl bg-[#0f0f1a] p-5 space-y-3">
            <p className="text-[9px] text-gray-600 uppercase tracking-widest mb-2">Font options</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {FONTS.map((f) => (
                <div key={f.label} className="flex items-center gap-2.5 bg-white/5 rounded-lg px-3 py-2.5">
                  <Component className="w-6 h-6 shrink-0" />
                  <span className={`text-white text-sm leading-none ${f.cls}`}>AgentsAccess</span>
                  <span className="text-[8px] text-gray-600 ml-auto shrink-0">{f.label}</span>
                </div>
              ))}
              {/* Dual-color font pairing */}
              {!dual && (
                <div className="flex items-center gap-2.5 bg-white/5 rounded-lg px-3 py-2.5">
                  <Component className="w-6 h-6 shrink-0" color="#f97316" />
                  <span className="text-white text-sm leading-none font-bold tracking-tight">AgentsAccess</span>
                  <span className="text-[8px] text-gray-600 ml-auto shrink-0">orange</span>
                </div>
              )}
            </div>
          </div>

          {/* Light background */}
          <div className="rounded-xl bg-gray-50 border border-gray-100 p-5 flex items-center gap-4 flex-wrap">
            {FONTS.slice(0, 3).map((f) => (
              <div key={f.label} className="flex items-center gap-2 bg-white rounded-lg border border-gray-100 px-3 py-2">
                <Component className="w-5 h-5 shrink-0" />
                <span className={`text-gray-900 text-sm leading-none ${f.cls}`}>AgentsAccess</span>
              </div>
            ))}
          </div>
        </section>
      ))}

      <p className="text-xs text-gray-400">Pick a number + font style. I&apos;ll finalize.</p>
    </main>
  )
}
