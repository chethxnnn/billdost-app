/**
 * Shared onboarding wizard types. Step components import OnboardingData
 * from here; the old import path (@/app/(auth)/onboarding/page) pointed
 * at a module that does not exist, which silently turned the type into
 * an error and poisoned typechecking across every step (blueprint C13).
 */
export interface OnboardingData {
  shopName: string
  logoFile: File | null
  logoPreview: string
  category: string
  hasGST: boolean
  gstin: string
  products: Array<{ name: string; price: number; unit: string; category: string }>
  upiId: string
  upiQrFile: File | null
  upiQrPreview: string
  includeUpiQr: boolean
  language: string
  staffMembers: Array<{ name: string; phone: string; role: string }>
}
