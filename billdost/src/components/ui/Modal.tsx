'use client'

import { useEffect, useSyncExternalStore, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'

/**
 * Shared overlay primitives (fix round 2, Stage 2).
 *
 * Why these exist: every hand-rolled pop-up in the shop app used to
 * render inline inside the page tree. Page content sits inside
 * PageTransition, whose enter animation keeps a transform on the
 * wrapper, and any transformed ancestor becomes the containing
 * block for position:fixed descendants. That is why the Magic
 * Extract modal rendered off-centre, shifted the page behind it
 * and produced a horizontal scrollbar. Rendering through a portal
 * at document.body level makes that class of bug impossible: no
 * page ancestor can offset, clip or resize an overlay.
 *
 * One pattern for all of them: portal at body, fixed inset-0,
 * scrim bg-black/40 with a light blur, house spring panel entry,
 * body scroll locked while open (reference counted, so nested
 * overlays restore correctly), Escape to close only where the
 * caller opts in (the components that already supported it).
 */

let lockCount = 0
let previousOverflow = ''

function lockScroll() {
  if (lockCount === 0) {
    previousOverflow = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
  }
  lockCount += 1
}

function unlockScroll() {
  lockCount = Math.max(0, lockCount - 1)
  if (lockCount === 0) {
    document.documentElement.style.overflow = previousOverflow
  }
}

function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    lockScroll()
    return unlockScroll
  }, [active])
}

function useEscape(active: boolean, onClose: () => void) {
  useEffect(() => {
    if (!active) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [active, onClose])
}

/** Portals render only on the client: SSR has no document.body. */
const emptySubscribe = () => () => {}
function useMounted() {
  return useSyncExternalStore(emptySubscribe, () => true, () => false)
}

const HOUSE_SPRING = { type: 'spring', stiffness: 380, damping: 36, mass: 0.9 } as const

interface ModalProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  /** Panel classes: background, radius, shadow and a max width such
   *  as max-w-[min(92vw,28rem)]. The panel is always w-full inside
   *  a padded, centred flex container. */
  panelClassName?: string
  /** 'fullscreen' makes the panel fill the viewport (mobile sheets). */
  variant?: 'center' | 'fullscreen'
  closeOnEscape?: boolean
  ariaLabel?: string
}

export function Modal({
  open,
  onClose,
  children,
  panelClassName = '',
  variant = 'center',
  closeOnEscape = false,
  ariaLabel,
}: ModalProps) {
  const mounted = useMounted()
  useScrollLock(open)
  useEscape(open && closeOnEscape, onClose)

  if (!open || !mounted) return null

  if (variant === 'fullscreen') {
    return createPortal(
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.18 }}
        className="fixed inset-0 z-[100] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
      >
        {children}
      </motion.div>,
      document.body
    )
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={HOUSE_SPRING}
        className={`relative w-full ${panelClassName}`}
      >
        {children}
      </motion.div>
    </div>,
    document.body
  )
}

interface DrawerProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  /** Panel classes: width (e.g. max-w-md), background, layout. */
  panelClassName?: string
  closeOnEscape?: boolean
  ariaLabel?: string
}

/**
 * Right slide-over drawer on the same portal pattern. Stays mounted
 * while closed (translated off-canvas) so the exit slide animates,
 * exactly like the hand-rolled drawers it replaces.
 */
export function Drawer({ open, onClose, children, panelClassName = '', closeOnEscape = false, ariaLabel }: DrawerProps) {
  const mounted = useMounted()
  useScrollLock(open)
  useEscape(open && closeOnEscape, onClose)

  if (!mounted) return null

  return createPortal(
    <>
      <div
        className={`fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className={`fixed right-0 top-0 z-[95] h-full w-full shadow-2xl transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        } ${panelClassName}`}
      >
        {children}
      </div>
    </>,
    document.body
  )
}
