import { TRPCError } from '@trpc/server'

/**
 * Maps a PostgREST error returned by supabase.rpc(...) onto a tRPC error
 * with a user-safe message. The money RPCs in migrations 0006 and 0013
 * raise stable errcodes: 42501 for membership and ownership failures,
 * 23514 for validation failures (totals mismatch, insufficient stock,
 * payment out of range, has_payments), P0002 for missing rows. Raw
 * database messages are never forwarded to the client.
 */
export function mapRpcError(error: { code?: string; message?: string } | null): TRPCError {
  const message = error?.message ?? ''

  if (message.includes('insufficient_stock')) {
    const product = message.split('insufficient_stock:')[1]?.trim()
    return new TRPCError({
      code: 'BAD_REQUEST',
      message: product
        ? `Stock khatam hai: ${product} ka stock bill ke liye kam pad raha hai.`
        : 'Stock bill ke liye kam pad raha hai.',
    })
  }
  if (message.includes('has_payments')) {
    return new TRPCError({
      code: 'BAD_REQUEST',
      message:
        'Is bill par payment aa chuka hai, isliye seedha cancel nahi ho sakta. Pehle refund record karo.',
    })
  }
  if (message.includes('payment amount out of range')) {
    return new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Payment amount balance se zyada hai, ya bill pehle se fully paid hai.',
    })
  }
  if (message.includes('invoice is not active') || message.includes('quotation cannot be converted')) {
    return new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Ye document ab is action ke liye available nahi hai.',
    })
  }
  if (error?.code === '42501') {
    return new TRPCError({
      code: 'FORBIDDEN',
      message: 'Ye item ya customer aapki shop ka nahi hai, ya aapko is action ki permission nahi hai.',
    })
  }
  if (error?.code === 'P0002') {
    return new TRPCError({ code: 'NOT_FOUND', message: 'Record nahi mila.' })
  }
  if (error?.code === '23514' || error?.code === '22023') {
    return new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Bill ki details check karo: totals ya amount sahi nahi hai.',
    })
  }
  return new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Kuch gadbad ho gayi. Dobara try karo.',
  })
}
