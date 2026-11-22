import JoinForm from '@/components/join/JoinForm'

/**
 * The staff join door (Stage 4). Public by design: the unguessable
 * token in the URL is the credential, checked server-side before
 * anything sensitive is shown, exactly like /activate/[token].
 */
export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  return (
    <div className="min-h-screen bg-[#F5F5F7] dark:bg-black flex items-center justify-center px-4 py-12">
      <JoinForm token={token} />
    </div>
  )
}
