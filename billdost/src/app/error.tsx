'use client'

import { ErrorFallback } from '@/components/shared/ErrorFallback'

/**
 * Route error boundary for the whole app. Renders the personalized
 * fallback (design brief error-state rule), never a raw error.
 * Next 16 passes unstable_retry (preferred) or reset.
 */
export default function AppError({
  error,
  unstable_retry,
  reset,
}: {
  error: Error & { digest?: string }
  unstable_retry?: () => void
  reset?: () => void
}) {
  return <ErrorFallback error={error} onRetry={unstable_retry ?? reset} variant="page" />
}
