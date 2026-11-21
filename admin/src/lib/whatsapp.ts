/**
 * WhatsApp Cloud API, platform identity (Admin Portal plan, Sections
 * 4 and 6F). The portal sends from the BillDost business number: the
 * activation template and broadcast templates. This mirrors the shop
 * app's module (billdost/src/server/whatsapp.ts): same Graph version,
 * same env-first configuration, and the same honesty rule: when
 * nothing is configured, sends fail with a typed NOT_CONNECTED result.
 * Nothing here ever reports a fake success.
 *
 *   WHATSAPP_CLOUD_API_TOKEN       platform access token
 *   WHATSAPP_PHONE_NUMBER_ID       BillDost sending number id
 *   WHATSAPP_BUSINESS_ACCOUNT_ID   WABA id (status display only)
 *   WHATSAPP_TEMPLATE_ACTIVATION   default billdost_activation_v1
 *   WHATSAPP_TEMPLATE_BROADCAST    default billdost_announcement_v1
 *   WHATSAPP_TEMPLATE_LANGUAGE     default en_US
 */

const GRAPH_VERSION = 'v21.0'
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`

export type WhatsAppSendResult =
  | { ok: true; messageId: string | null }
  | { ok: false; code: 'NOT_CONNECTED' | 'BAD_PHONE' | 'META_REJECTED'; message: string }

export function whatsappConfigured(): boolean {
  return Boolean(
    process.env.WHATSAPP_CLOUD_API_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID
  )
}

export function activationTemplateName(): string {
  return process.env.WHATSAPP_TEMPLATE_ACTIVATION ?? 'billdost_activation_v1'
}

export function broadcastTemplateName(): string {
  return process.env.WHATSAPP_TEMPLATE_BROADCAST ?? 'billdost_announcement_v1'
}

export function templateLanguage(): string {
  return process.env.WHATSAPP_TEMPLATE_LANGUAGE ?? 'en_US'
}

function normalizeIndianPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) return `91${digits}`
  if (digits.length === 12 && digits.startsWith('91')) return digits
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`
  return null
}

export async function sendTemplateMessage(args: {
  toPhone: string
  templateName: string
  bodyParams: string[]
}): Promise<WhatsAppSendResult> {
  const token = process.env.WHATSAPP_CLOUD_API_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  if (!token || !phoneNumberId) {
    return {
      ok: false,
      code: 'NOT_CONNECTED',
      message: 'WhatsApp is not connected yet. Add the Cloud API keys to the portal environment.',
    }
  }

  const to = normalizeIndianPhone(args.toPhone)
  if (!to) {
    return { ok: false, code: 'BAD_PHONE', message: 'Phone number samajh nahi aaya.' }
  }

  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: args.templateName,
      language: { code: templateLanguage() },
      components: [
        {
          type: 'body',
          parameters: args.bodyParams.map((text) => ({ type: 'text', text })),
        },
      ],
    },
  }

  try {
    const res = await fetch(`${GRAPH_BASE}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    const json = (await res.json().catch(() => null)) as {
      messages?: { id?: string }[]
      error?: { message?: string }
    } | null
    if (!res.ok) {
      return {
        ok: false,
        code: 'META_REJECTED',
        message: json?.error?.message ?? `Meta rejected the send (HTTP ${res.status}).`,
      }
    }
    return { ok: true, messageId: json?.messages?.[0]?.id ?? null }
  } catch (err) {
    return {
      ok: false,
      code: 'META_REJECTED',
      message: err instanceof Error ? err.message : 'Network error while sending.',
    }
  }
}

/**
 * The activation message (plan Section 10, Step 7). Template body:
 * "Namaste {{1}}, your BillDost shop {{2}} is ready. Set your password
 * and enter your shop here: {{3}} This link works once and expires in
 * 72 hours. Need help? Call {{4}}."
 */
export async function sendActivationMessage(args: {
  toPhone: string
  ownerName: string
  shopName: string
  activationLink: string
  supportPhone: string
}): Promise<WhatsAppSendResult> {
  return sendTemplateMessage({
    toPhone: args.toPhone,
    templateName: activationTemplateName(),
    bodyParams: [args.ownerName, args.shopName, args.activationLink, args.supportPhone],
  })
}
