import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

/**
 * In-app announcements (plan Section 6F): a banner inside the shop
 * app with an audience and a time window. The shop app reads the
 * announcements table through its own service role; this portal is
 * the only writer.
 */
export async function POST(req: NextRequest) {
  const { admin, error } = await requireAdmin('broadcasts')
  if (error) return error

  const body = (await req.json().catch(() => null)) as {
    title?: string
    body?: string
    audience?: string
    category?: string
    shop_id?: string
    starts_at?: string
    ends_at?: string | null
  } | null

  const title = (body?.title ?? '').trim()
  const text = (body?.body ?? '').trim()
  const audience = body?.audience ?? 'all'
  if (!title || !text) {
    return NextResponse.json(
      { ok: false, error: 'A title and a message are both needed.' },
      { status: 400 }
    )
  }
  if (audience === 'category' && !body?.category) {
    return NextResponse.json({ ok: false, error: 'Pick a category.' }, { status: 400 })
  }
  if (audience === 'shop' && !body?.shop_id) {
    return NextResponse.json({ ok: false, error: 'Pick a shop.' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error: insertError } = await supabase
    .from('announcements')
    .insert({
      title,
      body: text,
      audience,
      category: audience === 'category' ? body!.category : null,
      shop_id: audience === 'shop' ? body!.shop_id : null,
      starts_at: body?.starts_at ? new Date(body.starts_at).toISOString() : new Date().toISOString(),
      ends_at: body?.ends_at ? new Date(body.ends_at).toISOString() : null,
      created_by: admin.id,
    })
    .select('id')
    .single()

  if (insertError) {
    return NextResponse.json({ ok: false, error: 'Could not save the announcement.' }, { status: 500 })
  }

  await writeAudit(admin, 'announcement_created', {
    shopId: audience === 'shop' ? body!.shop_id : null,
    details: { title, audience },
  })

  return NextResponse.json({ ok: true, id: data.id })
}

export async function DELETE(req: NextRequest) {
  const { admin, error } = await requireAdmin('broadcasts')
  if (error) return error

  const id = req.nextUrl.searchParams.get('id')
  if (!id) {
    return NextResponse.json({ ok: false, error: 'Missing announcement id.' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { error: deleteError } = await supabase
    .from('announcements')
    .delete()
    .eq('id', id)

  if (deleteError) {
    return NextResponse.json({ ok: false, error: 'Could not remove it.' }, { status: 500 })
  }

  await writeAudit(admin, 'announcement_removed', { details: { announcement_id: id } })
  return NextResponse.json({ ok: true })
}
