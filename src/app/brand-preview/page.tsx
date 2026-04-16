import { LogoConceptA, LogoConceptB, LogoConceptC } from '@/components/brand/aa-logo'

export default function BrandPreviewPage() {
  const sizes = [16, 24, 32, 48, 64, 96]

  const concepts = [
    { name: 'Concept A — Linked Monogram', desc: 'Two geometric A\'s sharing a center stroke with a connected crossbar. Clean typographic ligature.', Component: LogoConceptA },
    { name: 'Concept B — Network Hub', desc: 'Central agent node with 4 radiating connections. Abstract network mark, no letterforms.', Component: LogoConceptB },
    { name: 'Concept C — Agent Visor', desc: 'Rounded square with visor slit and dot-eyes. Minimal bot/agent face silhouette.', Component: LogoConceptC },
  ]

  return (
    <main className="max-w-4xl mx-auto px-4 py-16 space-y-16">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Brand Mark Concepts</h1>
        <p className="text-gray-500">Pick one. Visit <code className="bg-gray-100 px-1 rounded">/brand-preview</code> to view.</p>
      </div>

      {concepts.map(({ name, desc, Component }) => (
        <section key={name} className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{name}</h2>
            <p className="text-sm text-gray-500">{desc}</p>
          </div>

          {/* Dark background row */}
          <div className="rounded-xl bg-[#0f0f1a] p-8 flex items-end gap-6 flex-wrap">
            {sizes.map((s) => (
              <div key={s} className="flex flex-col items-center gap-2">
                <Component className={`shrink-0`} style={{ width: s, height: s }} />
                <span className="text-[10px] text-gray-500">{s}px</span>
              </div>
            ))}
            {/* Navbar-style inline */}
            <div className="flex items-center gap-2 ml-6 pl-6 border-l border-white/10">
              <Component className="w-6 h-6" />
              <span className="text-sm font-bold text-white">AgentsAccess</span>
            </div>
          </div>

          {/* Light background row */}
          <div className="rounded-xl bg-gray-50 border border-gray-100 p-8 flex items-end gap-6 flex-wrap">
            {sizes.map((s) => (
              <div key={s} className="flex flex-col items-center gap-2">
                <Component className={`shrink-0`} style={{ width: s, height: s }} />
                <span className="text-[10px] text-gray-400">{s}px</span>
              </div>
            ))}
            <div className="flex items-center gap-2 ml-6 pl-6 border-l border-gray-200">
              <Component className="w-6 h-6" />
              <span className="text-sm font-bold text-gray-900">AgentsAccess</span>
            </div>
          </div>
        </section>
      ))}

      <p className="text-xs text-gray-400">
        After picking, update the <code>AALogo</code> and <code>AALogoMark</code> aliases
        in <code>src/components/brand/aa-logo.tsx</code> and delete this preview page.
      </p>
    </main>
  )
}
