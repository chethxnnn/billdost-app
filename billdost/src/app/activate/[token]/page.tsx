import ActivateForm from '@/components/activate/ActivateForm'

/**
 * The activation door (Admin Portal plan, Section 4). Public by
 * design: the unguessable token in the URL is the credential, checked
 * server-side before anything sensitive is shown.
 */
export default async function ActivatePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  return (
    <div className="min-h-screen bg-[#F5F5F7] dark:bg-black flex items-center justify-center px-4 py-12">
      <ActivateForm token={token} />
    </div>
  )
}
