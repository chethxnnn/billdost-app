import { redirect } from 'next/navigation'
import { getCurrentAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { can } from '@/lib/roles'
import { PageHeader } from '@/components/ui'
import SettingsForm from '@/components/SettingsForm'
import {
  activationTemplateName,
  broadcastTemplateName,
  templateLanguage,
  whatsappConfigured,
} from '@/lib/whatsapp'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const admin = await getCurrentAdmin()
  if (!admin) redirect('/login')
  if (!can(admin.role, 'settings')) redirect('/dashboard')

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('platform_settings')
    .select('key, value')
  const settings = new Map((data ?? []).map((r) => [r.key as string, r.value as string]))

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="The few platform values that are safe to change from a screen. Keys stay in the environment."
      />
      <SettingsForm
        uiTheme={admin.uiTheme}
        supportPhone={settings.get('support_phone') ?? ''}
        landingUrl={settings.get('landing_url') ?? 'https://billdost.in'}
        waConnected={whatsappConfigured()}
        waNumberIdSet={Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID)}
        activationTemplate={activationTemplateName()}
        broadcastTemplate={broadcastTemplateName()}
        templateLanguage={templateLanguage()}
      />
    </div>
  )
}
