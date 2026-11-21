import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

const EDITABLE_KEYS = ['support_phone', 'landing_url']

/**
 * Platform settings (plan Section 6I): the support phone shown inside
 * the shop app and on activation pages, and the landing URL. Changed
 * here, updated everywhere, no app release needed.
 */
export async function PATCH(req: NextRequest) {
  const { admin, error } = await requireAdmin('settings')
  if (error) return error

  const body = (await req.json().catch(() => null)) as {
    key?: string
    value?: string
  } | null

  if (!body?.key || !EDITABLE_KEYS.includes(body.key)) {
    return NextResponse.json({ ok: false, error: 'Unknown setting.' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { error: updateError } = await supabase
    .from('platform_settings')
    .update({ value: (body.value ?? '').trim(), updated_by: admin.id })
    .eq('key', body.key)

  if (updateError) {
    return NextResponse.json({ ok: false, error: 'Could not save.' }, { status: 500 })
  }

  await writeAudit(admin, 'setting_updated', {
    details: { key: body.key, value: (body.value ?? '').trim() },
  })
  return NextResponse.json({ ok: true })
}
