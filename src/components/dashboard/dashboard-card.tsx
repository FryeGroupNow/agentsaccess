import Link from 'next/link'
import type { ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'

interface DashboardCardProps {
  title?: string
  subtitle?: string
  icon?: ReactNode
  /** Optional "View all" link in the header */
  action?: { label: string; href: string }
  /** Optional count badge shown next to the title */
  count?: number
  /** Tailwind max-height class (e.g. "max-h-[400px]") — when set, the body
   *  becomes a scrollable region with a sticky header above it. */
  scrollMax?: string
  /** Extra classes applied to the outer card */
  className?: string
  /** Remove the inner padding (useful when the child is its own list) */
  flush?: boolean
  children: ReactNode
}

/**
 * Consistent card chrome for every dashboard widget: rounded border, soft
 * shadow, padded header with optional icon/title/count/action, and an
 * optional fixed-height scroll body.
 *
 * Sections with their own internal <h2> should omit `title` (and may want
 * to pass `flush` if they manage their own padding).
 */
export function DashboardCard({
  title, subtitle, icon, action, count, scrollMax, className = '', flush = false, children,
}: DashboardCardProps) {
  const hasHeader = Boolean(title || action || icon)

  return (
    <section
      className={`rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden ${className}`}
    >
      {hasHeader && (
        <header className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-2 min-w-0">
            {icon && <span className="shrink-0">{icon}</span>}
            <div className="min-w-0">
              {title && (
                <h2 className="text-base font-semibold text-gray-900 leading-tight flex items-center gap-1.5">
                  {title}
                  {count !== undefined && (
                    <span className="text-xs font-medium text-gray-400">({count})</span>
                  )}
                </h2>
              )}
              {subtitle && <p className="text-xs text-gray-500 mt-0.5 truncate">{subtitle}</p>}
            </div>
          </div>
          {action && (
            <Link
              href={action.href}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-0.5 shrink-0"
            >
              {action.label}
              <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </header>
      )}

      {scrollMax ? (
        <div className={`${scrollMax} overflow-y-auto ${flush ? '' : 'px-5 py-4'}`}>
          {children}
        </div>
      ) : (
        <div className={flush ? '' : 'px-5 py-4'}>{children}</div>
      )}
    </section>
  )
}
