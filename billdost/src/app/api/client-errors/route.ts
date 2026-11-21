import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

/**
 * Client error log endpoint. The personalized error fallback
 * (ErrorFallback) posts its digest here so a beta issue is traceable
 * in the client_errors table, the feed for the future Admin Portal
 * issue centre, without asking the shopkeeper what happened.
 *
 * Design rules:
 * - Fire-and-forget for the client: every outcome returns 204 except a
 *   body that is not JSON at all. A logging failure must never cascade
 *   into a user-visible failure.
 * - Rate-safe: payload fields are capped, identical digest+route
 *   reports inside 60 seconds are dropped, and each IP is limited to
 *   30 reports per minute (in-memory; this endpoint is best-effort
 *   telemetry, not a system of record).
 * - Session is best-effort: when a user is signed in, the row carries
 *   their user id and shop; anonymous errors still land with nulls.
 */

const MAX_PER_MINUTE = 30
const DEDUPE_WINDOW_MS = 60_000

const hits = new Map<string, number[]>()
const seen = new Map<string, number>()

function rateLimited(key: string): boolean {
  const now = Date.now()
  const list = (hits.get(key) ?? []).filter((t) => now - t < 60_000)
  list.push(now)
  hits.set(key, list)
  return list.length > MAX_PER_MINUTE
}

function duplicate(key: string): boolean {
  const now = Date.now()
  const last = seen.get(key)
  seen.set(key, now)
  return last !== undefined && now - last < DEDUPE_WINDOW_MS
}

function cap(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, max) : null
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const route = cap(body.route, 300)
  const digest = cap(body.digest, 200)
  const errorName = cap(body.name, 120)
  const message = cap(body.message, 2000)
  const appVersion = cap(body.version, 40)
  const userAgent = cap(req.headers.get('user-agent'), 400)

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (rateLimited(ip)) return new NextResponse(null, { status: 204 })
  if (digest && duplicate(`${ip}|${digest}|${route ?? ''}`)) {
    return new NextResponse(null, { status: 204 })
  }

  try {
    let userId: string | null = null
    let shopId: string | null = null

    const sessionClient = await createClient()
    const {
      data: { user },
    } = await sessionClient.auth.getUser()
    userId = user?.id ?? null

    const service = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    if (userId) {
      const { data: membership } = await service
        .from('staff_members')
        .select('shop_id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .limit(1)
        .single()
      shopId = membership?.shop_id ?? null
    }

    await service.from('client_errors').insert({
      shop_id: shopId,
      user_id: userId,
      route,
      digest,
      error_name: errorName,
      message,
      app_version: appVersion,
      user_agent: userAgent,
    })
  } catch {
    // Telemetry is best-effort: swallow and still answer 204.
  }

  return new NextResponse(null, { status: 204 })
}
