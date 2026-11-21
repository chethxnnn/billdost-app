import { stateCodeForName } from '@/lib/indian-states'
import { stateCodeFromGstin } from '@/lib/money'

/**
 * Tax facts the money engine needs, read defensively: the columns added
 * by migration 0002/0003 (shops.state_code, is_gst_registered, round_off,
 * customers.gstin, customers.state_code) may not exist on the live
 * database yet, so each lookup falls back to the columns that have
 * always existed (shops.state, shops.gstin) instead of failing the
 * whole mutation.
 */

export interface ShopTaxFacts {
  stateCode: string | null
  isGstRegistered: boolean
  roundOff: boolean
}

export async function getShopTaxFacts(supabase: any, shop: any): Promise<ShopTaxFacts> {
  const { data, error } = await supabase
    .from('shops')
    .select('state, state_code, gstin, is_gst_registered, round_off')
    .eq('id', shop.id)
    .single()

  if (!error && data) {
    return {
      stateCode:
        data.state_code ||
        stateCodeForName(data.state) ||
        stateCodeFromGstin(data.gstin),
      isGstRegistered: data.is_gst_registered ?? Boolean(data.gstin),
      roundOff: data.round_off ?? true,
    }
  }

  // Pre-migration schema: only state and gstin are guaranteed to exist.
  const { data: legacy } = await supabase
    .from('shops')
    .select('state, gstin')
    .eq('id', shop.id)
    .single()

  return {
    stateCode:
      stateCodeForName(legacy?.state ?? shop.state) ||
      stateCodeFromGstin(legacy?.gstin),
    isGstRegistered: Boolean(legacy?.gstin),
    roundOff: true,
  }
}

export interface CustomerTaxFacts {
  gstin: string | null
  stateCode: string | null
}

/**
 * Resolve a customer's GSTIN and state code. Values supplied on the
 * request win (the bill being created may carry fresher facts than the
 * stored row); otherwise the stored customer row is consulted, and a
 * supplied state name is converted to its GST code.
 */
export async function getCustomerTaxFacts(
  supabase: any,
  shopId: string,
  customerId: string | null | undefined,
  supplied: {
    customer_gstin?: string | null
    customer_state?: string | null
    customer_state_code?: string | null
  },
): Promise<CustomerTaxFacts> {
  let gstin = supplied.customer_gstin?.trim() || null
  let stateCode =
    supplied.customer_state_code ||
    stateCodeForName(supplied.customer_state) ||
    stateCodeFromGstin(gstin)

  if (customerId && (!gstin || !stateCode)) {
    const { data, error } = await supabase
      .from('customers')
      .select('gstin, state, state_code')
      .eq('id', customerId)
      .eq('shop_id', shopId)
      .single()

    if (!error && data) {
      gstin = gstin || data.gstin || null
      stateCode =
        stateCode ||
        data.state_code ||
        stateCodeForName(data.state) ||
        stateCodeFromGstin(gstin)
    }
  }

  return { gstin, stateCode }
}
