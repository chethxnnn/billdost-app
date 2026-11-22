import { router } from '../trpc'
import { analyticsRouter } from './analytics'
import { productsRouter } from './products'
import { customersRouter } from './customers'
import { invoicesRouter } from './invoices'
import { quotationsRouter } from './quotations'
import { reportsRouter } from './reports'
import { staffRouter } from './staff'
import { settingsRouter } from './settings'
import { aiRouter } from './ai'
import { whatsappRouter } from './whatsapp'
import { searchRouter } from './search'
import { remindersRouter } from './reminders'
import { expensesRouter } from './expenses'
import { paymentsRouter } from './payments'
import { announcementsRouter } from './announcements'

/**
 * Root tRPC app router.
 * Add new sub-routers here as features are built.
 */
export const appRouter = router({
  analytics: analyticsRouter,
  products:  productsRouter,
  customers: customersRouter,
  invoices:  invoicesRouter,
  quotations: quotationsRouter,
  reports: reportsRouter,
  staff: staffRouter,
  settings: settingsRouter,
  ai: aiRouter,
  whatsapp: whatsappRouter,
  search: searchRouter,
  reminders: remindersRouter,
  expenses: expensesRouter,
  payments: paymentsRouter,
  announcements: announcementsRouter,
})

export type AppRouter = typeof appRouter
