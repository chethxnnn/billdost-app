import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/** Cmd+K quick finder data: shops, requests and issue groups. */
export async function GET(req: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return error

  const q = (req.nextUrl.searchParams.get('q') ?? '').trim()
  if (q.length < 2) {
    return NextResponse.json({ shops: [], requests: [], issues: [] })
  }

  const supabase = createAdminClient()
  const like = `%${q.replace(/[%_]/g, '')}%`

  const [shopsRes, requestsRes, errorsRes] = await Promise.all([
    supabase
      .from('shops')
      .select('id, name, status, phone')
      .or(`name.ilike.${like},phone.ilike.${like}`)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(6),
    supabase
      .from('access_requests')
      .select('id, shop_name, status, whatsapp_number')
      .or(`shop_name.ilike.${like},owner_name.ilike.${like},whatsapp_number.ilike.${like}`)
      .order('created_at', { ascending: false })
      .limit(6),
    supabase
      .from('client_errors')
      .select('digest, error_name, message')
      .or(`error_name.ilike.${like},message.ilike.${like},digest.ilike.${like}`)
      .order('created_at', { ascending: false })
      .limit(60),
  ])

  const issueMap = new Map<string, { digest: string; title: string; count: number }>()
  for (const row of errorsRes.data ?? []) {
    const digest = (row.digest as string) ?? 'unknown'
    const existing = issueMap.get(digest)
    if (existing) existing.count += 1
    else
      issueMap.set(digest, {
        digest,
        title: (row.error_name as string) || (row.message as string) || 'Error',
        count: 1,
      })
  }

  return NextResponse.json({
    shops: shopsRes.data ?? [],
    requests: requestsRes.data ?? [],
    issues: [...issueMap.values()].slice(0, 6),
  })
}
