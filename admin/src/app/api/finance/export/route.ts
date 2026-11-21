import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { writeAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

/**
 * The finance CSV is built in the browser from data the page already
 * loaded; this endpoint exists so the export itself lands in the
 * audit log (plan Section 6G: the sheet the CA sees is a recorded
 * action, like everything else).
 */
export async function POST() {
  const { admin, error } = await requireAdmin('finance_export')
  if (error) return error

  await writeAudit(admin, 'finance_exported', {})
  return NextResponse.json({ ok: true })
}
