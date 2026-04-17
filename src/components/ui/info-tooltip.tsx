'use client'

import { useState, useRef, useEffect, useId } from 'react'
import { HelpCircle } from 'lucide-react'

interface InfoTooltipProps {
  /** Tooltip body text. Keep to 1–2 sentences. */
  children: React.ReactNode
  /** Optional label read by screen readers (defaults to "More info"). */
  label?: string
  /** Tailwind width class for the popover. Defaults to w-64. */
  width?: string
  /** Extra classes applied to the trigger button. */
  className?: string
  /** Icon size. "sm" (14px) fits next to small labels, "md" (16px) is default. */
  size?: 'sm' | 'md'
}

/**
 * Small "?" icon that reveals a short explanation popover on hover
 * (desktop) or tap (mobile).
 *
 * Kept intentionally self-contained: no floating-ui dependency, no
 * portals — the popover is absolutely positioned just below the
 * trigger. Callers choose `width` so the popover doesn't overflow in
 * constrained parents.
 */
export function InfoTooltip({
  children,
  label = 'More info',
  width = 'w-64',
  className = '',
  size = 'md',
}: InfoTooltipProps) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLSpanElement>(null)
  const id = useId()

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'

  return (
    <span ref={wrapperRef} className="relative inline-flex align-middle">
      <button
        type="button"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); setOpen((v) => !v) }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={(e) => {
          // Only close on mouse-leave when the pointer actually left the
          // wrapper — popover is adjacent, not overlapping, so we want it
          // to stay open while the user reads.
          const related = e.relatedTarget as Node | null
          if (!related || !wrapperRef.current?.contains(related)) setOpen(false)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-200 transition-colors ${className}`}
      >
        <HelpCircle className={iconSize} aria-hidden />
      </button>

      {open && (
        <span
          id={id}
          role="tooltip"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          className={`absolute z-50 top-full left-1/2 -translate-x-1/2 mt-1.5 ${width} max-w-[min(90vw,320px)] rounded-lg bg-gray-900 text-white text-xs font-normal leading-relaxed px-3 py-2 shadow-xl pointer-events-auto whitespace-normal`}
          style={{ transform: 'translateX(-50%)' }}
        >
          {children}
        </span>
      )}
    </span>
  )
}
