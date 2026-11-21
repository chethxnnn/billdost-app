import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { normalizePhone } from '@/lib/phone'

/**
 * WhatsApp Cloud API (blueprint C1). This module is the ONLY place that
 * talks to Meta. It replaces the whatsapp-web.js microservice entirely:
 * no unofficial automation, no ban risk, no per-shop Chromium.
 *
 * Configuration is env-first, per the Stage 2 decision that the Meta
 * account and template processing happen with Chethan after the app is
 * ready:
 *   WHATSAPP_CLOUD_API_TOKEN       platform or shop access token
 *   WHATSAPP_PHONE_NUMBER_ID       BillDost shared sending number
 *   WHATSAPP_BUSINESS_ACCOUNT_ID   WABA id for the shared number
 *   WHATSAPP_WEBHOOK_VERIFY_TOKEN  webhook GET verification
 *   WHATSAPP_APP_SECRET            webhook POST signature check
 *   WHATSAPP_TEMPLATE_INVOICE      default billdost_invoice_v1
 *   WHATSAPP_TEMPLATE_QUOTATION    default billdost_quotation_v1
 *   WHATSAPP_TEMPLATE_REMINDER     default billdost_payment_reminder_v1
 *   WHATSAPP_TEMPLATE_LOW_STOCK    default billdost_low_stock_v1
 *   WHATSAPP_TEMPLATE_LANGUAGE     default en_US
 *
 * A shop can carry its own phone_number_id and waba_id in
 * whatsapp_connections (migration 0009); when present and connected it
 * wins over the shared number. When nothing is configured, every send
 * fails with a typed NOT_CONNECTED error. Nothing in here ever reports
 * a fake success.
 */

const GRAPH_VERSION = 'v21.0'
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`

export type WhatsAppErrorCode = 'NOT_CONNECTED' | 'BAD_PHONE' | 'META_REJECTED' | 'NO_PDF'

export class WhatsAppError extends Error {
  code: WhatsAppErrorCode
  constructor(code: WhatsAppErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

function serviceClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export interface ResolvedConnection {
  source: 'shop' | 'shared'
  phoneNumberId: string
  wabaId: string | null
  displayPhone: string | null
  token: string
}

/** Resolves the sending identity for a shop, or null when unconfigured. */
export async function resolveConnection(shopId: string): Promise<ResolvedConnection | null> {
  const token = process.env.WHATSAPP_CLOUD_API_TOKEN
  if (!token) return null

  const supabase = serviceClient()
  const { data: conn } = await supabase
    .from('whatsapp_connections')
    .select('phone_number_id, waba_id, display_phone, status')
    .eq('shop_id', shopId)
    .single()

  if (conn && conn.status === 'connected' && conn.phone_number_id) {
    return {
      source: 'shop',
      phoneNumberId: conn.phone_number_id,
      wabaId: conn.waba_id,
      displayPhone: conn.display_phone,
      token,
    }
  }

  const sharedId = process.env.WHATSAPP_PHONE_NUMBER_ID
  if (sharedId) {
    return {
      source: 'shared',
      phoneNumberId: sharedId,
      wabaId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || null,
      displayPhone: null,
      token,
    }
  }

  return null
}

export interface ConnectionStatus {
  state: 'not_configured' | 'connected'
  source: 'shop' | 'shared' | null
  phoneNumberId: string | null
  wabaId: string | null
  displayPhone: string | null
  lastError: string | null
}

export async function getConnectionStatus(shopId: string): Promise<ConnectionStatus> {
  const supabase = serviceClient()
  const { data: conn } = await supabase
    .from('whatsapp_connections')
    .select('phone_number_id, waba_id, display_phone, status, last_error')
    .eq('shop_id', shopId)
    .single()

  const resolved = await resolveConnection(shopId)
  if (!resolved) {
    return {
      state: 'not_configured',
      source: null,
      phoneNumberId: conn?.phone_number_id ?? null,
      wabaId: conn?.waba_id ?? null,
      displayPhone: conn?.display_phone ?? null,
      lastError: conn?.last_error ?? null,
    }
  }
  return {
    state: 'connected',
    source: resolved.source,
    phoneNumberId: resolved.phoneNumberId,
    wabaId: resolved.wabaId,
    displayPhone: resolved.displayPhone,
    lastError: conn?.last_error ?? null,
  }
}

interface SendRecord {
  id: string
}

/** Inserts the whatsapp_sends audit row in queued state. */
async function createSendRow(input: {
  shopId: string
  invoiceId?: string | null
  quotationId?: string | null
  customerId?: string | null
  kind?: 'invoice' | 'quotation' | 'reminder' | 'low_stock' | 'test'
  toPhone: string
  templateName: string
}): Promise<SendRecord> {
  const supabase = serviceClient()
  const { data, error } = await supabase
    .from('whatsapp_sends')
    .insert({
      shop_id: input.shopId,
      invoice_id: input.invoiceId ?? null,
      quotation_id: input.quotationId ?? null,
      customer_id: input.customerId ?? null,
      kind: input.kind ?? 'invoice',
      to_phone: input.toPhone,
      template_name: input.templateName,
      status: 'queued',
    })
    .select('id')
    .single()
  if (error || !data) {
    throw new WhatsAppError('META_REJECTED', 'WhatsApp send record nahi ban paya. Dobara try karo.')
  }
  return data
}

async function finishSendRow(id: string, status: 'sent' | 'failed', providerMessageId?: string, errorText?: string) {
  const supabase = serviceClient()
  await supabase
    .from('whatsapp_sends')
    .update({
      status,
      provider_message_id: providerMessageId ?? null,
      error: errorText ?? null,
    })
    .eq('id', id)
}

async function markConnectionError(shopId: string, errorText: string) {
  const supabase = serviceClient()
  await supabase
    .from('whatsapp_connections')
    .update({ last_error: errorText })
    .eq('shop_id', shopId)
}

/** Uploads a PDF (base64) to Meta media and returns the media id. */
async function uploadPdf(conn: ResolvedConnection, pdfBase64: string, filename: string): Promise<string> {
  const bytes = Buffer.from(pdfBase64, 'base64')
  const form = new FormData()
  form.append('messaging_product', 'whatsapp')
  form.append('type', 'application/pdf')
  form.append('file', new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }), filename)

  const res = await fetch(`${GRAPH_BASE}/${conn.phoneNumberId}/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${conn.token}` },
    body: form,
  })
  const json: any = await res.json().catch(() => null)
  if (!res.ok || !json?.id) {
    throw new WhatsAppError(
      'META_REJECTED',
      `PDF upload fail ho gaya: ${json?.error?.message || res.statusText}`
    )
  }
  return json.id as string
}

interface MetaSendResult {
  messageId: string
}

async function postMessage(conn: ResolvedConnection, body: Record<string, unknown>): Promise<MetaSendResult> {
  const res = await fetch(`${GRAPH_BASE}/${conn.phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${conn.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', ...body }),
  })
  const json: any = await res.json().catch(() => null)
  if (!res.ok || !json?.messages?.[0]?.id) {
    throw new WhatsAppError(
      'META_REJECTED',
      `WhatsApp ne message reject kar diya: ${json?.error?.message || res.statusText}`
    )
  }
  return { messageId: json.messages[0].id as string }
}

/**
 * Sends the invoice template message (document header plus shop name,
 * bill number and amount body parameters, per the billdost_invoice_v1
 * template in blueprint C1). The PDF can arrive as base64 (uploaded to
 * Meta media first) or as a fetchable URL. Without either, the send is
 * refused: a bill message with no bill is worse than no message.
 */
export async function sendInvoiceTemplate(input: {
  shopId: string
  invoiceId: string
  toPhone: string
  shopName: string
  invoiceNumber: string
  amount: number
  pdfBase64?: string | null
  pdfUrl?: string | null
}): Promise<{ sendId: string; messageId: string }> {
  const to = normalizePhone(input.toPhone)
  if (!to) throw new WhatsAppError('BAD_PHONE', 'Customer ka phone number sahi nahi hai.')

  const conn = await resolveConnection(input.shopId)
  if (!conn) {
    throw new WhatsAppError(
      'NOT_CONNECTED',
      'WhatsApp abhi connected nahi hai. Settings mein WhatsApp connect karo, ya share option use karo.'
    )
  }
  if (!input.pdfBase64 && !input.pdfUrl) {
    throw new WhatsAppError('NO_PDF', 'Bill ka PDF ready nahi hai, isliye WhatsApp par nahi bhej sakte.')
  }

  const templateName = process.env.WHATSAPP_TEMPLATE_INVOICE || 'billdost_invoice_v1'
  const language = process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'en_US'
  const send = await createSendRow({
    shopId: input.shopId,
    invoiceId: input.invoiceId,
    toPhone: to,
    templateName,
  })

  try {
    const document = input.pdfBase64
      ? { id: await uploadPdf(conn, input.pdfBase64, `${input.invoiceNumber}.pdf`), filename: `${input.invoiceNumber}.pdf` }
      : { link: input.pdfUrl as string, filename: `${input.invoiceNumber}.pdf` }

    const result = await postMessage(conn, {
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: language },
        components: [
          { type: 'header', parameters: [{ type: 'document', document }] },
          {
            type: 'body',
            parameters: [
              { type: 'text', text: input.shopName },
              { type: 'text', text: input.invoiceNumber },
              { type: 'text', text: `₹${input.amount}` },
            ],
          },
        ],
      },
    })

    await finishSendRow(send.id, 'sent', result.messageId)
    return { sendId: send.id, messageId: result.messageId }
  } catch (err) {
    const text = err instanceof Error ? err.message : 'Unknown WhatsApp error'
    await finishSendRow(send.id, 'failed', undefined, text)
    await markConnectionError(input.shopId, text)
    throw err
  }
}

/**
 * Sends the quotation template message, the exact mirror of
 * sendInvoiceTemplate (blueprint C8): document header plus shop name,
 * quotation number and amount body parameters. Same honesty rules: no
 * connection or no PDF means a typed refusal, never a fake success.
 */
export async function sendQuotationTemplate(input: {
  shopId: string
  quotationId: string
  customerId?: string | null
  toPhone: string
  shopName: string
  quotationNumber: string
  amount: number
  pdfBase64?: string | null
  pdfUrl?: string | null
}): Promise<{ sendId: string; messageId: string }> {
  const to = normalizePhone(input.toPhone)
  if (!to) throw new WhatsAppError('BAD_PHONE', 'Customer ka phone number sahi nahi hai.')

  const conn = await resolveConnection(input.shopId)
  if (!conn) {
    throw new WhatsAppError(
      'NOT_CONNECTED',
      'WhatsApp abhi connected nahi hai. Settings mein WhatsApp connect karo, ya share option use karo.'
    )
  }
  if (!input.pdfBase64 && !input.pdfUrl) {
    throw new WhatsAppError('NO_PDF', 'Quotation ka PDF ready nahi hai, isliye WhatsApp par nahi bhej sakte.')
  }

  const templateName = process.env.WHATSAPP_TEMPLATE_QUOTATION || 'billdost_quotation_v1'
  const language = process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'en_US'
  const send = await createSendRow({
    shopId: input.shopId,
    quotationId: input.quotationId,
    customerId: input.customerId ?? null,
    kind: 'quotation',
    toPhone: to,
    templateName,
  })

  try {
    const document = input.pdfBase64
      ? { id: await uploadPdf(conn, input.pdfBase64, `${input.quotationNumber}.pdf`), filename: `${input.quotationNumber}.pdf` }
      : { link: input.pdfUrl as string, filename: `${input.quotationNumber}.pdf` }

    const result = await postMessage(conn, {
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: language },
        components: [
          { type: 'header', parameters: [{ type: 'document', document }] },
          {
            type: 'body',
            parameters: [
              { type: 'text', text: input.shopName },
              { type: 'text', text: input.quotationNumber },
              { type: 'text', text: `₹${input.amount}` },
            ],
          },
        ],
      },
    })

    await finishSendRow(send.id, 'sent', result.messageId)
    return { sendId: send.id, messageId: result.messageId }
  } catch (err) {
    const text = err instanceof Error ? err.message : 'Unknown WhatsApp error'
    await finishSendRow(send.id, 'failed', undefined, text)
    await markConnectionError(input.shopId, text)
    throw err
  }
}

/**
 * Sends the udhaar payment reminder template (blueprint D7): customer
 * name, shop name and the total outstanding amount. Utility template
 * only, never free-form text, so reminders stay inside Meta's rules.
 */
export async function sendReminderTemplate(input: {
  shopId: string
  customerId: string
  toPhone: string
  customerName: string
  shopName: string
  amount: number
}): Promise<{ sendId: string; messageId: string }> {
  const to = normalizePhone(input.toPhone)
  if (!to) throw new WhatsAppError('BAD_PHONE', 'Customer ka phone number sahi nahi hai.')

  const conn = await resolveConnection(input.shopId)
  if (!conn) {
    throw new WhatsAppError(
      'NOT_CONNECTED',
      'WhatsApp abhi connected nahi hai. Settings mein WhatsApp connect karo, ya share option use karo.'
    )
  }

  const templateName = process.env.WHATSAPP_TEMPLATE_REMINDER || 'billdost_payment_reminder_v1'
  const language = process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'en_US'
  const send = await createSendRow({
    shopId: input.shopId,
    customerId: input.customerId,
    kind: 'reminder',
    toPhone: to,
    templateName,
  })

  try {
    const result = await postMessage(conn, {
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: language },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: input.customerName },
              { type: 'text', text: input.shopName },
              { type: 'text', text: `₹${input.amount}` },
            ],
          },
        ],
      },
    })

    await finishSendRow(send.id, 'sent', result.messageId)
    return { sendId: send.id, messageId: result.messageId }
  } catch (err) {
    const text = err instanceof Error ? err.message : 'Unknown WhatsApp error'
    await finishSendRow(send.id, 'failed', undefined, text)
    await markConnectionError(input.shopId, text)
    throw err
  }
}

/**
 * Writes one reminder_log row (blueprint D7). Service role only: the
 * table has no authenticated insert policy by design. Logging must
 * never break a send flow, so failures here are swallowed.
 */
export async function logReminder(input: {
  shopId: string
  customerId: string
  invoiceId?: string | null
  status: 'sent' | 'failed'
}): Promise<void> {
  try {
    const supabase = serviceClient()
    await supabase.from('reminder_log').insert({
      shop_id: input.shopId,
      customer_id: input.customerId,
      invoice_id: input.invoiceId ?? null,
      channel: 'whatsapp',
      status: input.status,
    })
  } catch {
    // Audit logging is best-effort; the send result is the truth.
  }
}

/**
 * Sends the low-stock digest to the shop owner (blueprint D20): one
 * batched message, never per-sale spam. Body parameters are the shop
 * name, the low item count and a short item list. On success the
 * included products are stamped low_stock_alerted_at so the same
 * crossing is not re-alerted until a restock clears the stamp (the
 * batch RPC clears it when stock rises above the threshold).
 */
export async function sendLowStockDigestTemplate(input: {
  shopId: string
  toPhone: string
  shopName: string
  itemsText: string
  count: number
  productIds: string[]
}): Promise<{ sendId: string; messageId: string }> {
  const to = normalizePhone(input.toPhone)
  if (!to) throw new WhatsAppError('BAD_PHONE', 'Shop ka phone number sahi nahi hai.')

  const conn = await resolveConnection(input.shopId)
  if (!conn) {
    throw new WhatsAppError(
      'NOT_CONNECTED',
      'WhatsApp abhi connected nahi hai. Settings mein WhatsApp connect karo.'
    )
  }

  const templateName = process.env.WHATSAPP_TEMPLATE_LOW_STOCK || 'billdost_low_stock_v1'
  const language = process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'en_US'
  const send = await createSendRow({
    shopId: input.shopId,
    kind: 'low_stock',
    toPhone: to,
    templateName,
  })

  try {
    const result = await postMessage(conn, {
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: language },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: input.shopName },
              { type: 'text', text: String(input.count) },
              { type: 'text', text: input.itemsText },
            ],
          },
        ],
      },
    })

    await finishSendRow(send.id, 'sent', result.messageId)
    if (input.productIds.length > 0) {
      const supabase = serviceClient()
      await supabase
        .from('products')
        .update({ low_stock_alerted_at: new Date().toISOString() })
        .eq('shop_id', input.shopId)
        .in('id', input.productIds)
    }
    return { sendId: send.id, messageId: result.messageId }
  } catch (err) {
    const text = err instanceof Error ? err.message : 'Unknown WhatsApp error'
    await finishSendRow(send.id, 'failed', undefined, text)
    await markConnectionError(input.shopId, text)
    throw err
  }
}

/**
 * Sends a plain text message. Meta only delivers these inside a 24
 * hour customer service window opened by the customer's own message;
 * outside it, Meta rejects and the rejection is surfaced, never hidden.
 */
export async function sendTextMessage(input: {
  shopId: string
  toPhone: string
  text: string
}): Promise<{ messageId: string }> {
  const to = normalizePhone(input.toPhone)
  if (!to) throw new WhatsAppError('BAD_PHONE', 'Phone number sahi nahi hai.')

  const conn = await resolveConnection(input.shopId)
  if (!conn) {
    throw new WhatsAppError('NOT_CONNECTED', 'WhatsApp abhi connected nahi hai.')
  }
  return postMessage(conn, {
    to,
    type: 'text',
    text: { body: input.text },
  })
}

/**
 * Sends the connection test: a real template message (hello_world by
 * default, the template Meta provisions on test numbers) so a shop can
 * verify its setup end to end. Configurable via WHATSAPP_TEMPLATE_TEST.
 */
export async function sendTestTemplate(input: {
  shopId: string
  toPhone: string
}): Promise<{ sendId: string; messageId: string }> {
  const to = normalizePhone(input.toPhone)
  if (!to) throw new WhatsAppError('BAD_PHONE', 'Phone number sahi nahi hai.')

  const conn = await resolveConnection(input.shopId)
  if (!conn) {
    throw new WhatsAppError('NOT_CONNECTED', 'WhatsApp abhi connected nahi hai.')
  }

  const templateName = process.env.WHATSAPP_TEMPLATE_TEST || 'hello_world'
  const language = process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'en_US'
  const send = await createSendRow({ shopId: input.shopId, toPhone: to, templateName, kind: 'test' })

  try {
    const result = await postMessage(conn, {
      to,
      type: 'template',
      template: { name: templateName, language: { code: language } },
    })
    await finishSendRow(send.id, 'sent', result.messageId)
    return { sendId: send.id, messageId: result.messageId }
  } catch (err) {
    const text = err instanceof Error ? err.message : 'Unknown WhatsApp error'
    await finishSendRow(send.id, 'failed', undefined, text)
    await markConnectionError(input.shopId, text)
    throw err
  }
}
