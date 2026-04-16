import {
  Logo1, Logo2, Logo3, Logo4, Logo5,
  Logo6, Logo7, Logo8, Logo9, Logo10,
} from '@/components/brand/aa-logo'

export default function BrandPreviewPage() {
  const sizes = [16, 24, 32, 48, 64, 96]

  const concepts = [
    { name: '1. Stacked AA (indigo)',       Component: Logo1,  desc: 'Small A nested inside the peak of a large A. Both have crossbars — reads as letters, not triangles.' },
    { name: '2. Stacked AA (dual color)',   Component: Logo2,  desc: 'Same stacked layout — bottom A is indigo, top A is orange. Two-tone mark.' },
    { name: '3. Side-by-Side AA (indigo)',  Component: Logo3,  desc: 'Two A letters next to each other with overlapping bases. Ligature feel.' },
    { name: '4. Side-by-Side AA (dual)',    Component: Logo4,  desc: 'Left A indigo, right A orange. Clean two-letter read.' },
    { name: '5. Bold Filled A',            Component: Logo5,  desc: 'Single thick filled A with a cutout hole. Road-sign bold. Unmistakable at any size.' },
    { name: '6. Agent Badge',              Component: Logo6,  desc: 'Shield outline with a bold filled A inside. Verified-agent credential.' },
    { name: '7. Circuit A',               Component: Logo7,  desc: 'Right-angle PCB traces forming an A. Solder dots at vertices.' },
    { name: '8. Portal A',                Component: Logo8,  desc: 'Two concentric A outlines with dark fill between them. Doorway/portal feel.' },
    { name: '9. Bot Face',                Component: Logo9,  desc: 'Rounded rect head, two eyes, visor mouth, antenna, ear nodes. Minimal agent face.' },
    { name: '10. Monogram Ring',           Component: Logo10, desc: '"AA" inside a thin circle. Corporate, clean, reads at every size.' },
  ]

  return (
    <main className="max-w-5xl mx-auto px-4 py-16 space-y-14">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Brand Concepts — Round 3</h1>
        <p className="text-gray-500 text-sm">10 logos. Each shown in both indigo and orange colorways (where applicable) at 16px → 96px.</p>
      </div>

      {concepts.map(({ name, desc, Component }) => {
        const isDual = name.includes('dual');
        return (
          <section key={name} className="space-y-3">
            <div>
              <h2 className="text-base font-bold text-gray-900">{name}</h2>
              <p className="text-xs text-gray-500">{desc}</p>
            </div>

            {/* Dark row */}
            <div className="rounded-xl bg-[#0f0f1a] p-5 flex items-end gap-4 flex-wrap">
              {sizes.map((s) => (
                <div key={s} className="flex flex-col items-center gap-1">
                  <Component className="shrink-0" style={{ width: s, height: s }} />
                  <span className="text-[9px] text-gray-600">{s}</span>
                </div>
              ))}
              <div className="flex items-center gap-2 ml-3 pl-3 border-l border-white/10">
                <Component className="w-6 h-6" />
                <span className="text-sm font-bold text-white">AgentsAccess</span>
              </div>
            </div>

            {/* Orange colorway (skip for dual-color logos — they already show both) */}
            {!isDual && (
              <div className="rounded-xl bg-[#0f0f1a] p-5 flex items-end gap-4 flex-wrap border border-orange-900/30">
                {sizes.map((s) => (
                  <div key={s} className="flex flex-col items-center gap-1">
                    <Component className="shrink-0" style={{ width: s, height: s }} color="#f97316" />
                    <span className="text-[9px] text-gray-600">{s}</span>
                  </div>
                ))}
                <div className="flex items-center gap-2 ml-3 pl-3 border-l border-white/10">
                  <Component className="w-6 h-6" color="#f97316" />
                  <span className="text-sm font-bold text-white">AgentsAccess</span>
                </div>
                <span className="text-[9px] text-orange-400 ml-2">orange</span>
              </div>
            )}

            {/* Light background */}
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-5 flex items-end gap-4 flex-wrap">
              {sizes.map((s) => (
                <div key={s} className="flex flex-col items-center gap-1">
                  <Component className="shrink-0" style={{ width: s, height: s }} />
                  <span className="text-[9px] text-gray-400">{s}</span>
                </div>
              ))}
              <div className="flex items-center gap-2 ml-3 pl-3 border-l border-gray-200">
                <Component className="w-6 h-6" />
                <span className="text-sm font-bold text-gray-900">AgentsAccess</span>
              </div>
            </div>
          </section>
        )
      })}

      <p className="text-xs text-gray-400">
        Tell me the number and I&apos;ll finalize — alias it to AALogo, update favicon, delete this page.
      </p>
    </main>
  )
}
