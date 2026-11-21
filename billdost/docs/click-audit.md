# BillDost Click Audit

Date: 21 November 2026. Stage 5, Task B.
Method: production build route table captured from `npm run build` (42 routes), then every `page.tsx` under `src/app` and every shared component that renders controls was read line by line. Every button, link, tab, menu item, icon button, form submit, toggle and action select was traced to its handler, href or mutation. Grep sweeps were run for dead-control patterns: empty `onClick` handlers, `href="#"`, "Coming soon" placeholder handlers, console.log-only handlers, decorative search inputs, and disabled buttons presented as real features.
Runtime verification: the production build was started with `next start` and the public pages were loaded over HTTP. Pages that returned 200 and rendered are marked "works (runtime-verified)". Dashboard and other signed-in controls need a live session and data, so they are marked "works (code-verified)": the handler was traced to a real mutation, navigation or browser API in code, but the click was not exercised live. Nothing is claimed as runtime-verified that was not actually loaded.
Verification after fixes: `npx tsc --noEmit` clean, `npx vitest run` 75 of 75 tests passed, `npm run build` green with the same 42 routes.

## Summary

- Total controls checked: 314
- Works: 308
- Fixed: 5
- Removed: 1

### Fixed

1. Customers list view, Edit button: was `opacity-0 group-hover:opacity-100` at 32px, invisible and unreachable on touch. Now always visible on touch at 44px with the Stage 3 pattern (`opacity-100 sm:opacity-0 sm:group-hover:opacity-100`, `tap w-11 h-11 sm:w-8 sm:h-8`). File: `src/app/(dashboard)/customers/page.tsx`
2. Customers list view, Delete button: same hover-only problem, same fix. File: `src/app/(dashboard)/customers/page.tsx`
3. Inventory, Adjust button: was hover-only (`opacity-0 group-hover:opacity-100`), so stock adjustment could not be opened on a phone. Now visible on touch, hover-reveal on larger screens. File: `src/app/(dashboard)/inventory/page.tsx`
4. Dashboard, low stock arrow link to `/catalog`: was hover-only and invisible on touch. Now always visible. File: `src/app/(dashboard)/dashboard/page.tsx`
5. Magic Extract modal, preview row remove button: was hover-only, so a wrongly extracted item could not be removed on touch. Now visible on touch. File: `src/components/dashboard/MagicExtractModal.tsx`

### Removed

1. Onboarding Step 7 (Admin), 4-digit Quick PIN inputs: the step promised "Create a quick PIN for fast login" and "Use this PIN to quickly unlock the app on your phone", but the PIN was never sent to the server (the onboarding router deliberately has no PIN field; PINs are not stored) and no PIN login exists anywhere in the app. The control collected a credential for a feature that does not exist, so it was removed honestly instead of wired to invented backend. The `pin` field was removed from `src/components/onboarding/types.ts` and from the wizard state in `src/app/onboarding/page.tsx`, the PIN block and its copy were removed from `src/components/onboarding/StepAdmin.tsx` (the staff invite, which does work, remains), and the misleading "Security: PIN Set" summary row was removed from `src/components/onboarding/StepComplete.tsx`.

### Patterns checked with no dead controls found

- `onClick={() => {}}`: exactly 3 hits, all sonner toast cancel actions (invoices bulk mark paid, quotation convert, staff remove). Sonner dismisses the toast when its action button is clicked, so these work as Cancel buttons.
- `href="#"`: none in the codebase.
- "Coming soon" or placeholder toast handlers: none.
- Console.log-only handlers: none. Remaining console calls are error logging in speech recognition, PDF generation and the global error boundary.
- Decorative search inputs: none. Every search input is wired to state and a tRPC query or a local filter (catalog, customers, inventory, invoices, payments, udhaar, GlobalSearch, QuickAddGrid).
- Disabled buttons: all are pending-state guards (`isPending`, `loading`, `saving`) or empty-input guards (POS with no lines, WhatsApp test with no phone, onboarding Continue with invalid input). None presents a fake feature.
- The dashboard weekly chart tooltip and the Chatbot sparkle icon use hover opacity but are decorative, pointer-events-none or non-interactive, and are not controls.

## Route: /

Server component. Checks the session and redirects.

| Control | Action/handler | Status |
| --- | --- | --- |
| Automatic redirect | `supabase.auth.getUser()`, then `redirect('/dashboard')` if signed in, else `redirect('/login')` | works (runtime-verified) |

## Route: /_not-found

| Control | Action/handler | Status |
| --- | --- | --- |
| Dashboard link | href `/dashboard` | works (code-verified) |

## Route: /login

Rendered inside the auth layout (logo link and ThemeToggle are covered under Shared components: AuthLayout).

| Control | Action/handler | Status |
| --- | --- | --- |
| Login form submit | `handleLogin` calls `supabase.auth.signInWithPassword`, then routes to dashboard or onboarding; disabled only while loading | works (runtime-verified) |
| Forgot password link | href `/forgot-password` | works (runtime-verified) |
| Sign up link | href `/signup` | works (runtime-verified) |

## Route: /signup

| Control | Action/handler | Status |
| --- | --- | --- |
| Signup form submit | `handleSignup` calls `supabase.auth.signUp` | works (runtime-verified) |
| Go back button (success state) | `setSuccess(false)`, returns to the form | works (runtime-verified) |
| Terms link | href `/terms` | works (runtime-verified) |
| Privacy link | href `/privacy` | works (runtime-verified) |
| Sign in link | href `/login` | works (runtime-verified) |

## Route: /forgot-password

| Control | Action/handler | Status |
| --- | --- | --- |
| Reset form submit | `handleReset` calls `supabase.auth.resetPasswordForEmail` | works (runtime-verified) |
| Try another email button (sent state) | Resets the sent state so another address can be entered | works (runtime-verified) |
| Login link | href `/login` | works (runtime-verified) |

## Route: /reset-password

| Control | Action/handler | Status |
| --- | --- | --- |
| Reset form submit | `handleSubmit` calls `supabase.auth.updateUser` with the new password | works (runtime-verified) |
| Dashboard link (success state) | href `/dashboard` | works (runtime-verified) |
| Login link | href `/login` | works (runtime-verified) |

## Route: /auth/callback

| Control | Action/handler | Status |
| --- | --- | --- |
| (none) | Route handler only: exchanges the auth code for a session and redirects. No UI controls. | works (code-verified) |

## Route: /auth/signout

| Control | Action/handler | Status |
| --- | --- | --- |
| (none) | Route handler only: signs out and redirects to `/login`. No UI controls. | works (code-verified) |

## Route: /terms

| Control | Action/handler | Status |
| --- | --- | --- |
| Back link | href `/signup` | works (runtime-verified) |

## Route: /privacy

| Control | Action/handler | Status |
| --- | --- | --- |
| Back link | href `/signup` | works (runtime-verified) |

## Route: /onboarding

The page itself is guarded: loading it without a session returned a 307 redirect to `/login` from the production server, which is the correct behaviour. Wizard controls are code-verified. Step state lives in the wizard; Continue and Back move between the 8 steps, and the final save fires one mutation.

| Control | Action/handler | Status |
| --- | --- | --- |
| Learn more about BillDost link | href `https://www.billdost.in`, opens in a new tab | works (code-verified) |
| Step 1: logo upload area | Click opens the hidden file input; `handleLogo` validates size (2MB) and sets the preview | works (code-verified) |
| Step 1: Continue button | `onNext`; disabled until the shop name is at least 2 characters | works (code-verified) |
| Step 2: category option buttons | `handleSelect` sets the category in wizard state | works (code-verified) |
| Step 2: Back button | `onBack` | works (code-verified) |
| Step 2: Continue button | `onNext`; disabled until a category is chosen | works (code-verified) |
| Step 3: GST registered toggle | Div onClick flips `hasGST` in wizard state | works (code-verified) |
| Step 3: Back button | `onBack` | works (code-verified) |
| Step 3: Continue button | `onNext`; disabled when GST is on and the GSTIN is invalid | works (code-verified) |
| Step 4: starter product name, price and unit inputs | Controlled inputs editing wizard state | works (code-verified) |
| Step 4: Remove item button | Removes the product row from wizard state | works (code-verified) |
| Step 4: Add another item button | Appends an empty product row | works (code-verified) |
| Step 4: Back button | `onBack` | works (code-verified) |
| Step 4: Continue / Skip button | `onNext` | works (code-verified) |
| Step 5: QR upload area | Click opens the hidden file input; `handleQR` validates size and sets the preview | works (code-verified) |
| Step 5: Show QR on invoices toggle | Div onClick flips `includeUpiQr` in wizard state | works (code-verified) |
| Step 5: Back button | `onBack` | works (code-verified) |
| Step 5: Continue / Skip for now button | `onNext`; label depends on whether UPI details were entered | works (code-verified) |
| Step 6: language cards | Button onClick sets `language` in wizard state; the choice is saved to the shop record and later synced by LanguageSync | works (code-verified) |
| Step 6: Back button | `onBack` | works (code-verified) |
| Step 6: Continue button | `onNext` | works (code-verified) |
| Step 7: Add Staff Members toggle | Div onClick flips the staff section and adds a first empty staff row | works (code-verified) |
| Step 7: staff name and phone inputs | Controlled inputs via `updateStaff` | works (code-verified) |
| Step 7: staff role select | `updateStaff` with role `billing` or `viewer`; sent to `completeOnboarding` | works (code-verified) |
| Step 7: remove staff button | `removeStaff` removes the row (stopPropagation so the toggle does not flip) | works (code-verified) |
| Step 7: Add another staff member button | `addStaff` appends a row | works (code-verified) |
| Step 7: 4-digit Quick PIN inputs | Promised PIN login that does not exist; the PIN was never sent or stored | removed |
| Step 7: Back button | `onBack` | works (code-verified) |
| Step 7: Continue button | `onNext` | works (code-verified) |
| Step 8: Create my shop button | `onSave` runs `saveToSupabase`: uploads logo and QR to storage, then fires `trpc.onboarding.completeOnboarding`, then routes to `/dashboard`; disabled while saving | works (code-verified) |
| Step 8: Go back to edit details button | `onBack`; disabled while saving | works (code-verified) |

## Route: /ca/[token]

Public read-only CA share page. The token is hashed and checked for revocation and expiry on the server; an invalid token renders the invalid-link state (loaded from the production server with HTTP 200).

| Control | Action/handler | Status |
| --- | --- | --- |
| (none) | Read-only report page by design. No interactive controls. | works (runtime-verified) |

## Route: /print/invoice/[id]

| Control | Action/handler | Status |
| --- | --- | --- |
| Auto-print on load | `AutoPrint` effect calls `window.print()` after 350ms | works (code-verified) |
| Print Karo button | `window.print()` | works (code-verified) |
| Back link | href `/invoices/[id]` | works (code-verified) |

## Route: /dashboard

| Control | Action/handler | Status |
| --- | --- | --- |
| Create (Naya Bill) button | href `/invoices/new` | works (code-verified) |
| Recent invoices: View All link | href `/invoices` | works (code-verified) |
| Recent invoices: First Bill link (empty state) | href `/invoices/new` | works (code-verified) |
| Recent invoices: invoice row | href `/invoices/[id]` | works (code-verified) |
| Activity: View All link | href `/activity` | works (code-verified) |
| Low stock: View All link | href `/low-stock` | works (code-verified) |
| Low stock: item link | href `/catalog` | works (code-verified) |
| Low stock: arrow link | href `/catalog`; was hover-only invisible on touch | fixed |
| Analytics preview: View Full link | href `/analytics` | works (code-verified) |
| Quick actions: Naya Bill | href `/invoices/new` | works (code-verified) |
| Quick actions: Customer | href `/customers` | works (code-verified) |
| Quick actions: Quotation | href `/quotations/new` | works (code-verified) |
| Quick actions: Catalog | href `/catalog` | works (code-verified) |

## Route: /activity

| Control | Action/handler | Status |
| --- | --- | --- |
| (none) | Read-only activity list from `trpc.analytics.recentActivity`. No interactive controls. | works (code-verified) |

## Route: /analytics

| Control | Action/handler | Status |
| --- | --- | --- |
| (none) | Read-only charts and widgets from five analytics queries. No interactive controls. | works (code-verified) |

## Route: /catalog

| Control | Action/handler | Status |
| --- | --- | --- |
| Search input | Controlled input; the product query (`products.list`) receives the search term | works (code-verified) |
| Category tabs | `setActiveCategory` filters the product query | works (code-verified) |
| Scan button | Opens BarcodeScanner; a detected code runs `handleScanLookup` via `products.getByBarcode` | works (code-verified) |
| Magic Extract button | `setMagicOpen(true)` opens MagicExtractModal | works (code-verified) |
| Add Product button | `handleAdd` opens the product drawer with an empty form | works (code-verified) |
| Empty state Add button | `handleAdd` opens the product drawer | works (code-verified) |
| Product card Edit button | `onEdit` opens the drawer with the product loaded | works (code-verified) |
| Product card Delete button | `onDelete` opens the delete confirmation modal | works (code-verified) |
| Drawer close button and backdrop | Close the drawer; Escape also closes | works (code-verified) |
| Drawer form submit (Save) | `handleSubmit` fires `products.create` or `products.update` | works (code-verified) |
| Drawer barcode Scan button | Opens BarcodeScanner and fills the barcode field on detection | works (code-verified) |
| Delete modal Cancel button | Closes the modal | works (code-verified) |
| Delete modal Confirm button | Fires `products.hardDelete` | works (code-verified) |

## Route: /customers

| Control | Action/handler | Status |
| --- | --- | --- |
| Search input | Controlled input; the customer query receives the search term | works (code-verified) |
| Import CSV button | Opens the hidden file input; `handleFileUpload` parses the sheet and fires `customers.createMany` | works (code-verified) |
| Add Customer button | Opens the customer drawer with an empty form | works (code-verified) |
| Grid / list view toggle | Switches the rendering between card grid and table | works (code-verified) |
| Customer card click | `onViewAnalytics` opens CustomerAnalyticsDrawer | works (code-verified) |
| Card Edit button | Opens the drawer with the customer loaded (stopPropagation) | works (code-verified) |
| Card Delete button | Opens the delete confirmation modal (stopPropagation) | works (code-verified) |
| Card Udhaar amount link | href `/udhaar` | works (code-verified) |
| Card WhatsApp link | href `https://wa.me/<phone>` | works (code-verified) |
| List Edit button | Opens the drawer with the customer loaded; was hover-only invisible on touch | fixed |
| List Delete button | Opens the delete confirmation modal; was hover-only invisible on touch | fixed |
| Drawer close button and backdrop | Close the drawer | works (code-verified) |
| Drawer form submit (Save) | `handleSubmit` fires `customers.create` or `customers.update` | works (code-verified) |
| Tag remove chips | Remove the tag from the form state before save | works (code-verified) |
| Delete modal Cancel button | Closes the modal | works (code-verified) |
| Delete modal Confirm button | Fires `customers.delete` | works (code-verified) |

## Route: /inventory

Includes the StockAdjustModal and BatchExpiryTab, which render only inside this page.

| Control | Action/handler | Status |
| --- | --- | --- |
| Stock tab | `setActiveTab('stock')`; the stock table renders | works (code-verified) |
| Ledger tab | `setActiveTab('ledger')`; the ledger query loads and renders | works (code-verified) |
| Report tab | `setActiveTab('report')`; the monthly report renders | works (code-verified) |
| Batch and Expiry tab | `setActiveTab('batches')`; BatchExpiryTab renders | works (code-verified) |
| Search input | Controlled input filtering the stock list locally | works (code-verified) |
| Adjust button | `setSelectedProduct` opens StockAdjustModal; was hover-only invisible on touch | fixed |
| Report month select | `setReportMonth`; the `monthlyReport` query refetches | works (code-verified) |
| Report year select | `setReportYear`; the `monthlyReport` query refetches | works (code-verified) |
| StockAdjustModal: Add / Subtract / Set mode buttons | `setMode` switches the adjustment mode | works (code-verified) |
| StockAdjustModal: Save button | `handleSave` fires `products.updateStock` | works (code-verified) |
| StockAdjustModal: Cancel and Close buttons | Close the modal | works (code-verified) |
| BatchExpiryTab: product select | Selects the product whose batches are listed | works (code-verified) |
| BatchExpiryTab: Batch Jodo button | `handleAdd` fires the add-batch mutation | works (code-verified) |
| BatchExpiryTab: Write Off buttons | Fire the write-off mutation for the batch | works (code-verified) |

## Route: /invoices

| Control | Action/handler | Status |
| --- | --- | --- |
| Search input | Controlled input; the invoice query receives the search term | works (code-verified) |
| Status tabs | `setStatus` filters the invoice query | works (code-verified) |
| Grid / list view toggle | Switches the rendering between cards and table | works (code-verified) |
| New Invoice links | href `/invoices/new` | works (code-verified) |
| Card select checkbox | Toggles the invoice in the bulk selection set | works (code-verified) |
| Card View Details link | href `/invoices/[id]` | works (code-verified) |
| Select-all checkbox (list view) | Selects or clears all visible invoices | works (code-verified) |
| Bulk bar Clear button | `setSelectedIds(new Set())` | works (code-verified) |
| Bulk bar Mark Paid button | `handleBulkMarkPaid` shows a confirm toast, then fires the bulk mark-paid mutation (manager and owner roles) | works (code-verified) |

## Route: /invoices/[id]

| Control | Action/handler | Status |
| --- | --- | --- |
| Back link | href `/invoices` | works (code-verified) |
| Record Payment button | Opens the payment form | works (code-verified) |
| WhatsApp button | `handleWhatsApp`: sends via WhatsApp Cloud API (`whatsapp.sendInvoice`), falls back to sharing the PDF, then to a wa.me link | works (code-verified) |
| Download button | `handleDownload` calls the preview ref `downloadPDF()`, producing a paginated PDF file | works (code-verified) |
| Thermal Print link | href `/print/invoice/[id]` | works (code-verified) |
| Cancel Bill button | First click arms the confirmation state (`setConfirmingCancel`) | works (code-verified) |
| Confirm cancel button | `handleCancelInvoice` fires `invoices.cancel` | works (code-verified) |
| Payment form Save button | `handleRecordPayment` fires the record-payment mutation | works (code-verified) |
| Payment form Cancel button | Closes the payment form | works (code-verified) |
| Payment mode select | Controlled select in the payment form | works (code-verified) |

## Route: /invoices/new

The form itself is InvoiceForm and the preview is InvoicePreview, covered under Shared components.

| Control | Action/handler | Status |
| --- | --- | --- |
| Fetch Quotation button | `handleFetchQuotation` fetches by number via `quotations.getByNumber` and fills the form | works (code-verified) |
| Form submit | `handleSubmit(onSubmit)` fires `invoices.create`, then routes to `/invoices/[id]` | works (code-verified) |
| Sticky bar submit button | Submits the form via `form="invoice-form"` | works (code-verified) |
| Cancel button | `router.back()` | works (code-verified) |
| Right panel Products tab | `setRightPanel('products')` shows QuickAddGrid | works (code-verified) |
| Right panel Preview tab | `setRightPanel('preview')` shows InvoicePreview | works (code-verified) |
| Preview Download PDF button (panel) | Calls the preview ref `downloadPDF()` | works (code-verified) |
| Mobile Preview open button | Opens the preview modal | works (code-verified) |
| Mobile Preview close button | Closes the preview modal | works (code-verified) |
| Preview Download PDF button (mobile modal) | Calls the preview ref `downloadPDF()` | works (code-verified) |

## Route: /quotations

| Control | Action/handler | Status |
| --- | --- | --- |
| Search input | Controlled input; the quotation query receives the search term | works (code-verified) |
| Status tabs | Filter the quotation query by status | works (code-verified) |
| New Quotation links | href `/quotations/new` | works (code-verified) |
| View Details link | href `/quotations/[id]` | works (code-verified) |

## Route: /quotations/[id]

| Control | Action/handler | Status |
| --- | --- | --- |
| Back link | href `/quotations` | works (code-verified) |
| Mark Sent button | `handleStatus` fires the update-status mutation | works (code-verified) |
| Mark Accepted button | `handleStatus` fires the update-status mutation | works (code-verified) |
| Mark Rejected button | `handleStatus` fires the update-status mutation | works (code-verified) |
| Convert to Invoice button | `handleConvert` shows a confirm toast, then fires `convertToInvoice` and routes to `/invoices/[id]` | works (code-verified) |
| WhatsApp button | Sends via WhatsApp Cloud API (`whatsapp.sendQuotation`), falls back to a wa.me link | works (code-verified) |
| Download PDF button | Calls the preview ref `downloadPDF()` | works (code-verified) |

## Route: /quotations/new

| Control | Action/handler | Status |
| --- | --- | --- |
| Form submit | Fires `quotations.create`, then routes to `/quotations/[id]` | works (code-verified) |
| Sticky bar submit button | Submits the form via the form id | works (code-verified) |
| Cancel button | `router.back()` | works (code-verified) |
| Mobile Preview open button | Opens the preview modal | works (code-verified) |
| Mobile Preview close button | Closes the preview modal | works (code-verified) |
| WhatsApp button | `handleWhatsApp` opens a wa.me link with the quotation text (phone normalized) | works (code-verified) |
| Download PDF button | Calls the preview ref `downloadPDF()` | works (code-verified) |

## Route: /pos

| Control | Action/handler | Status |
| --- | --- | --- |
| Holds toggle | Shows or hides the held bills list (localStorage) | works (code-verified) |
| Dashboard link | href `/dashboard` | works (code-verified) |
| Hold resume button | Loads the held bill back into the counter | works (code-verified) |
| Hold delete button | Removes the held bill from localStorage | works (code-verified) |
| Barcode input (Enter) | `handleBarcode` looks the code up via `products.getByBarcode` and adds the item | works (code-verified) |
| Camera Scan button | Opens BarcodeScanner | works (code-verified) |
| Quantity plus and minus buttons | `changeQty` updates the line quantity | works (code-verified) |
| Payment mode pills | `setPayChoice` selects cash, UPI or udhaar for the sale | works (code-verified) |
| Hold button | `saveHold` stores the current bill in localStorage | works (code-verified) |
| Complete Sale button | `complete()` fires `invoices.create` with source `pos`; also bound to F9. Disabled only when the bill is empty | works (code-verified) |
| Clear bill button | `resetBill` empties the counter | works (code-verified) |
| Done state: Thermal Print link | href `/print/invoice/[id]` | works (code-verified) |
| Done state: WhatsApp link | href `/invoices/[id]`, where the WhatsApp send lives | works (code-verified) |
| Done state: Naya Bill button | `resetBill` starts a fresh bill | works (code-verified) |

## Route: /expenses

| Control | Action/handler | Status |
| --- | --- | --- |
| Month input | Controlled input; the expense query refetches for the month | works (code-verified) |
| Category select | Controlled select filtering and assigning the category | works (code-verified) |
| Add Category button | `handleAddCategory` fires the add-category mutation; disabled while the name is empty | works (code-verified) |
| Mode pills | Switch the form between expense types | works (code-verified) |
| Form submit | `handleSubmit` fires the create or update expense mutation | works (code-verified) |
| Cancel edit button | `resetForm` clears the edit state | works (code-verified) |
| Show-cancelled checkbox | Toggles cancelled expenses in the list | works (code-verified) |
| Row Edit button | Loads the expense into the form | works (code-verified) |
| Row Cancel button | `handleCancel` fires the cancel mutation | works (code-verified) |

## Route: /payments

| Control | Action/handler | Status |
| --- | --- | --- |
| Search input | Controlled input; the `payments.list` query receives the search term | works (code-verified) |
| Date from input | Controlled input filtering the list | works (code-verified) |
| Date to input | Controlled input filtering the list | works (code-verified) |
| Mode filter pills | `setMode` filters by payment mode | works (code-verified) |
| Row Bill link | href `/invoices/[id]` | works (code-verified) |

## Route: /udhaar

| Control | Action/handler | Status |
| --- | --- | --- |
| Search input | Controlled input; the udhaar query receives the search term | works (code-verified) |
| Payment Liya button | Opens the payment form for that customer | works (code-verified) |
| Pay form Save button | `handleRecordPayment` fires the record-udhaar-payment mutation | works (code-verified) |
| Pay form Cancel button | Closes the payment form | works (code-verified) |
| Pay form mode pills | Select the payment mode | works (code-verified) |
| Reminder button | `handleReminder` sends via WhatsApp Cloud API (`whatsapp.sendReminder`), falls back to a wa.me link | works (code-verified) |
| Pause toggle | `handlePauseToggle` fires the set-paused mutation | works (code-verified) |

## Route: /low-stock

| Control | Action/handler | Status |
| --- | --- | --- |
| WhatsApp Digest button | `handleDigest` fires the low-stock digest send | works (code-verified) |
| Alerts toggle checkbox | Fires the update-low-stock-alerts settings mutation | works (code-verified) |
| Stock Bharo link | href `/inventory` | works (code-verified) |

## Route: /reports/gst

| Control | Action/handler | Status |
| --- | --- | --- |
| Date from and to inputs | Controlled inputs; the GST report query refetches | works (code-verified) |
| Export CSV button | `handleExportCSV` builds a Blob and downloads a CSV file; rendered only when data exists | works (code-verified) |
| Export Excel button | `handleExportExcel` writes the workbook via `XLSX.writeFile`; rendered only when data exists | works (code-verified) |

## Route: /reports/gstr1

| Control | Action/handler | Status |
| --- | --- | --- |
| Month input | Controlled input driving both export links and the summary query | works (code-verified) |
| GSTR-1 JSON download link | href `/api/exports/gstr1?month=<month>` downloads the JSON file | works (code-verified) |
| Tally XML download link | href `/api/exports/tally?month=<month>` downloads the XML file | works (code-verified) |
| CA link days select | Sets the share link expiry in days | works (code-verified) |
| Link Banao button | `handleCreateLink` fires the create-share-link mutation | works (code-verified) |
| Copy button | `navigator.clipboard.writeText` copies the CA link | works (code-verified) |
| Revoke button | `handleRevoke` fires the revoke-share-link mutation | works (code-verified) |

## Route: /settings

Includes the settings tab layout, which renders above every settings subpage.

| Control | Action/handler | Status |
| --- | --- | --- |
| Settings tab: General | href `/settings` | works (code-verified) |
| Settings tab: Invoices | href `/settings/invoices` | works (code-verified) |
| Settings tab: Staff | href `/settings/staff` | works (code-verified) |
| Settings tab: WhatsApp | href `/settings/whatsapp` | works (code-verified) |
| General form submit (Save) | `handleSubmit` fires `settings.updateGeneral` | works (code-verified) |
| Logo Lagao / Badlo button | Opens the hidden file input; `handleLogoUpload` uploads to the `logos` storage bucket and saves the URL | works (code-verified) |
| Logo Hatao button | Clears `logo_url` in the form state | works (code-verified) |
| Language select | LanguageSwitcher; covered under Shared components | works (code-verified) |
| Logout button | Runs the logout hook (sign out and redirect to login) | works (code-verified) |

## Route: /settings/invoices

| Control | Action/handler | Status |
| --- | --- | --- |
| Form submit (Save) | Fires `settings.updateInvoiceSettings` | works (code-verified) |
| Thermal width 58mm button | Sets the thermal width in form state | works (code-verified) |
| Thermal width 80mm button | Sets the thermal width in form state | works (code-verified) |
| UPI QR checkbox | Toggles showing the UPI QR on invoices | works (code-verified) |

## Route: /settings/staff

| Control | Action/handler | Status |
| --- | --- | --- |
| Invite form submit | Fires `staff.invite` | works (code-verified) |
| Role select (per staff member) | Fires `staff.updateRole` on change | works (code-verified) |
| Reactivate button | Fires `staff.reactivate` | works (code-verified) |
| Remove button | Shows a confirm toast, then fires `staff.remove` | works (code-verified) |

## Route: /settings/whatsapp

| Control | Action/handler | Status |
| --- | --- | --- |
| Test message button (connected state) | Fires the send-test-message mutation; disabled until a phone number is entered | works (code-verified) |
| Disconnect button | Fires the disconnect mutation (shop-source connections only) | works (code-verified) |
| Save connection button (not connected state) | Fires the save-connection mutation; disabled until phone number id and WABA id are entered | works (code-verified) |

## API routes (no UI)

These routes render no page and no controls. Each was checked to exist and to be wired to its real consumer.

| Control | Action/handler | Status |
| --- | --- | --- |
| /api/chat | Chat endpoint consumed by the Chatbot `useChat` transport | works (code-verified) |
| /api/client-errors | Error log endpoint posted to by ErrorFallback | works (code-verified) |
| /api/exports/gstr1 | File download consumed by the GSTR-1 JSON link on /reports/gstr1 | works (code-verified) |
| /api/exports/tally | File download consumed by the Tally XML link on /reports/gstr1 | works (code-verified) |
| /api/trpc/[trpc] | tRPC handler serving every mutation and query named in this audit | works (code-verified) |
| /api/webhooks/whatsapp | WhatsApp Cloud API webhook receiver for delivery status writeback | works (code-verified) |

## Error surfaces (error.tsx, global-error.tsx)

Not separate rows in the route table, but they render controls and are covered here. Both delegate to ErrorFallback, covered under Shared components.

| Control | Action/handler | Status |
| --- | --- | --- |
| error.tsx Retry | Renders ErrorFallback with the boundary reset as `onRetry` | works (code-verified) |
| global-error.tsx Retry button | Calls the available reset or reload path | works (code-verified) |
| global-error.tsx Dashboard link | href `/dashboard` | works (code-verified) |

## Shared components: AuthLayout

Renders around /login, /signup, /forgot-password and /reset-password.

| Control | Action/handler | Status |
| --- | --- | --- |
| Logo link | href `/` | works (runtime-verified) |
| ThemeToggle | Covered under Shared components: ThemeToggle | works (runtime-verified) |

## Shared components: Sidebar

| Control | Action/handler | Status |
| --- | --- | --- |
| Dashboard link | href `/dashboard` | works (code-verified) |
| Naya Bill link | href `/invoices/new` | works (code-verified) |
| POS link | href `/pos` | works (code-verified) |
| Invoices link | href `/invoices` | works (code-verified) |
| Quotations link | href `/quotations` | works (code-verified) |
| Customers link | href `/customers` | works (code-verified) |
| Udhaar link | href `/udhaar` | works (code-verified) |
| Payments link | href `/payments` | works (code-verified) |
| Catalog link | href `/catalog` | works (code-verified) |
| Inventory link | href `/inventory` | works (code-verified) |
| Low Stock link | href `/low-stock` | works (code-verified) |
| Expenses link | href `/expenses` | works (code-verified) |
| Analytics link | href `/analytics` | works (code-verified) |
| GST Report link | href `/reports/gst` | works (code-verified) |
| Settings link | href `/settings` | works (code-verified) |
| WhatsApp settings link | href `/settings/whatsapp` | works (code-verified) |
| Language select | LanguageSwitcher; fires `settings.updateLanguage` | works (code-verified) |
| Logout button | Runs the logout hook (sign out and redirect to login) | works (code-verified) |
| Collapse toggle | `onToggle` collapses or expands the sidebar in DashboardShell state | works (code-verified) |

## Shared components: Topbar

| Control | Action/handler | Status |
| --- | --- | --- |
| Logo link | href `/dashboard` | works (code-verified) |
| Mobile search toggle | `setMobileSearchOpen` shows or hides GlobalSearch on mobile | works (code-verified) |
| Naya Bill link | href `/invoices/new` (rendered when the shop context allows) | works (code-verified) |
| ThemeToggle button | Covered under Shared components: ThemeToggle | works (code-verified) |
| Avatar menu: Settings item | `router.push('/settings')` | works (code-verified) |
| Avatar menu: Logout item | Runs the logout hook | works (code-verified) |

## Shared components: NotificationDropdown

| Control | Action/handler | Status |
| --- | --- | --- |
| Bell button | `handleToggle` opens or closes the dropdown | works (code-verified) |
| Sab dekho link | href `/activity`; closes the dropdown on click | works (code-verified) |

## Shared components: BottomNav

| Control | Action/handler | Status |
| --- | --- | --- |
| Home link | href `/dashboard` | works (code-verified) |
| Bills link | href `/invoices` | works (code-verified) |
| New Bill center button | href `/invoices/new` | works (code-verified) |
| Customers link | href `/customers` | works (code-verified) |
| Settings link | href `/settings` | works (code-verified) |

## Shared components: GlobalSearch

| Control | Action/handler | Status |
| --- | --- | --- |
| Search input | Debounced input firing `trpc.search.global`; Cmd/Ctrl+K focuses it | works (code-verified) |
| Invoice result button | Navigates to `/invoices/[id]` | works (code-verified) |
| Customer result button | Navigates to `/customers` | works (code-verified) |
| Product result button | Navigates to `/catalog` | works (code-verified) |

## Shared components: Chatbot

| Control | Action/handler | Status |
| --- | --- | --- |
| Chat FAB button | `setIsOpen` opens or closes the chat panel | works (code-verified) |
| Mic button | Toggles SpeechRecognition listening and fills the input with the transcript | works (code-verified) |
| Message form submit (Send) | `handleFormSubmit` sends via `useChat` to `/api/chat`; navigation tool results call `router.push`. Disabled only while the input is empty or a reply is streaming | works (code-verified) |

## Shared components: InvoiceForm

Used by /invoices/new. Plain text inputs (customer name, GSTIN, quantities, prices) are react-hook-form fields validated on submit and are not listed individually.

| Control | Action/handler | Status |
| --- | --- | --- |
| Customer select | Fills the customer name, phone and GSTIN fields from the chosen customer | works (code-verified) |
| Barcode Scan button | Opens BarcodeScanner; `handleBarcode` adds the scanned product via `products.getByBarcode` | works (code-verified) |
| Mobile QuickAdd toggle | Shows or hides QuickAddGrid on mobile | works (code-verified) |
| Item catalog select | `handleItemSelect` fills name, price, unit and GST rate for the line | works (code-verified) |
| Item remove button | `remove(index)` deletes the line | works (code-verified) |
| Add Item button | `append` adds an empty line | works (code-verified) |
| Payment status radios | react-hook-form registered radios (paid, partial, unpaid) | works (code-verified) |
| UPI QR checkbox | react-hook-form registered checkbox controlling the QR block on the invoice | works (code-verified) |

## Shared components: InvoicePreview and QuotationPreview

No direct controls. Both expose a ref API (`downloadPDF`, `sharePDF`, `getPDFBase64` / `getPDFBlob`) built on html2canvas and jsPDF pagination. Every caller was verified: invoice detail Download and WhatsApp, quotation detail Download and WhatsApp, and the new invoice and quotation preview panels.

## Shared components: QuickAddGrid

Used by InvoiceForm, QuotationForm and POS.

| Control | Action/handler | Status |
| --- | --- | --- |
| Search input | Controlled input filtering products locally | works (code-verified) |
| Category tabs | `setActiveCategory` filters the grid | works (code-verified) |
| Product tile button | `onAddProduct` adds the product to the bill | works (code-verified) |

## Shared components: QuotationForm

Used by /quotations/new. Mirrors InvoiceForm without the barcode scan.

| Control | Action/handler | Status |
| --- | --- | --- |
| Customer select | Fills the customer fields from the chosen customer | works (code-verified) |
| Mobile QuickAdd toggle | Shows or hides QuickAddGrid on mobile | works (code-verified) |
| Item catalog select | Fills the line from the chosen product | works (code-verified) |
| Item remove button | Removes the line | works (code-verified) |
| Add Item button | Appends an empty line | works (code-verified) |

## Shared components: MagicExtractModal

Used by /catalog.

| Control | Action/handler | Status |
| --- | --- | --- |
| Backdrop and Close button | Close the modal | works (code-verified) |
| Image / URL tabs | `setTab` switches the extraction source | works (code-verified) |
| Image upload area | Opens the hidden file input; the chosen image fires the extract-from-image mutation | works (code-verified) |
| URL Extract button | `handleExtractUrl` fires the extract-from-URL mutation | works (code-verified) |
| Preview row inputs | Controlled inputs editing the extracted name, price and category before save | works (code-verified) |
| Preview row remove button | Removes the extracted row; was hover-only invisible on touch | fixed |
| Discard All button | `setPreviewItems([])` clears the preview | works (code-verified) |
| Cancel button | Closes the modal | works (code-verified) |
| Save All button | `handleSaveAll` fires `products.createMany` | works (code-verified) |

## Shared components: CustomerAnalyticsDrawer

Used by /customers.

| Control | Action/handler | Status |
| --- | --- | --- |
| Backdrop and Close button | `onClose` closes the drawer | works (code-verified) |
| Invoice row link | href `/invoices/[id]` | works (code-verified) |

## Shared components: BarcodeScanner

Used by /catalog, InvoiceForm and POS.

| Control | Action/handler | Status |
| --- | --- | --- |
| Close button | `onClose` closes the scanner and stops the camera stream | works (code-verified) |
| Manual code Add Karo button | `submitManual` passes the typed code to `onDetected`; Enter in the input does the same, so USB scanner guns work | works (code-verified) |
| Camera auto-detect | BarcodeDetector loop passes the first detected code to `onDetected`; where the browser lacks the API the modal says so plainly and the manual path stays usable | works (code-verified) |

## Shared components: LanguageSwitcher

| Control | Action/handler | Status |
| --- | --- | --- |
| Language select | `handleChange` updates the local language store and fires `settings.updateLanguage` | works (code-verified) |

## Shared components: ThemeToggle

| Control | Action/handler | Status |
| --- | --- | --- |
| Theme toggle button | `setTheme` switches between light and dark via next-themes | works (runtime-verified) |

## Shared components: ErrorFallback

Used by error.tsx and for failed queries.

| Control | Action/handler | Status |
| --- | --- | --- |
| Dobara Try Karo (Retry) button | Calls the `onRetry` reset passed by the error boundary | works (code-verified) |
| Dashboard Jao link | href `/dashboard` (or the `homeHref` passed in) | works (code-verified) |
| Details for support disclosure | Native details element; expands the technical details | works (code-verified) |
| Copy details button | `handleCopy` writes the error details to the clipboard and shows a Copied state | works (code-verified) |

## Notes and limits

- StockAdjustModal does not close on backdrop click; it closes via its Close and Cancel buttons, which both work. This is a common modal pattern and was left as is.
- Dashboard data actions (mutations, sends, exports) could not be exercised live without a signed-in session and a real shop database; they are code-verified only, as marked.
- The three sonner toast cancel buttons use an empty arrow function because sonner dismisses the toast itself when an action button is clicked; the confirm path of each toast was traced to its mutation.
