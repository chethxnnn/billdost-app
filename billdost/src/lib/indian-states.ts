// Single source of truth for Indian states and their GST state codes.
// Used by onboarding, shop settings, customers, and the invoice and
// quotation forms for place-of-supply determination (see src/lib/money.ts).

export interface IndianState {
  name: string
  /** Two digit GST state code, as a string (leading zero matters). */
  code: string
}

export const INDIAN_STATES: IndianState[] = [
  { name: 'Jammu and Kashmir', code: '01' },
  { name: 'Himachal Pradesh', code: '02' },
  { name: 'Punjab', code: '03' },
  { name: 'Chandigarh', code: '04' },
  { name: 'Uttarakhand', code: '05' },
  { name: 'Haryana', code: '06' },
  { name: 'Delhi', code: '07' },
  { name: 'Rajasthan', code: '08' },
  { name: 'Uttar Pradesh', code: '09' },
  { name: 'Bihar', code: '10' },
  { name: 'Sikkim', code: '11' },
  { name: 'Arunachal Pradesh', code: '12' },
  { name: 'Nagaland', code: '13' },
  { name: 'Manipur', code: '14' },
  { name: 'Mizoram', code: '15' },
  { name: 'Tripura', code: '16' },
  { name: 'Meghalaya', code: '17' },
  { name: 'Assam', code: '18' },
  { name: 'West Bengal', code: '19' },
  { name: 'Jharkhand', code: '20' },
  { name: 'Odisha', code: '21' },
  { name: 'Chhattisgarh', code: '22' },
  { name: 'Madhya Pradesh', code: '23' },
  { name: 'Gujarat', code: '24' },
  { name: 'Daman and Diu', code: '25' },
  { name: 'Dadra and Nagar Haveli and Daman and Diu', code: '26' },
  { name: 'Maharashtra', code: '27' },
  { name: 'Karnataka', code: '29' },
  { name: 'Goa', code: '30' },
  { name: 'Lakshadweep', code: '31' },
  { name: 'Kerala', code: '32' },
  { name: 'Tamil Nadu', code: '33' },
  { name: 'Puducherry', code: '34' },
  { name: 'Andaman and Nicobar Islands', code: '35' },
  { name: 'Telangana', code: '36' },
  { name: 'Andhra Pradesh', code: '37' },
  { name: 'Ladakh', code: '38' },
  { name: 'Other Territory', code: '97' },
]

/** GST state code for a state name (case-insensitive), or null if unknown. */
export function stateCodeForName(name: string | null | undefined): string | null {
  if (!name) return null
  const needle = name.trim().toLowerCase()
  if (!needle) return null
  // Accept a bare code being passed through as well.
  if (/^\d{2}$/.test(needle)) {
    return INDIAN_STATES.some((s) => s.code === needle) ? needle : null
  }
  const found = INDIAN_STATES.find((s) => s.name.toLowerCase() === needle)
  return found ? found.code : null
}

/** State name for a GST state code, or null if unknown. */
export function stateNameForCode(code: string | null | undefined): string | null {
  if (!code) return null
  const found = INDIAN_STATES.find((s) => s.code === code)
  return found ? found.name : null
}

/** Normalise any state reference (name or code) to a GST state code. */
export function normaliseStateCode(
  state: string | null | undefined,
  stateCode?: string | null,
): string | null {
  if (stateCode && /^\d{2}$/.test(stateCode)) return stateCode
  return stateCodeForName(state)
}

/**
 * GSTIN format: 15 characters = 2 digit state code, 5 letters
 * (PAN holder), 4 digits, 1 letter, 1 alphanumeric entity code,
 * the letter Z, and 1 alphanumeric check character. Format only:
 * this does not verify the checksum digit or that the number is
 * actually issued.
 */
export const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{1}Z[0-9A-Z]{1}$/

/** True when the value is a correctly formatted GSTIN. */
export function isValidGstin(value: string | null | undefined): boolean {
  if (!value) return false
  return GSTIN_PATTERN.test(value.trim().toUpperCase())
}
