'use client'

import { useState } from 'react'
import { trpc } from '@/lib/trpc/client'
import { toast } from 'sonner'
import { Trash2, UserPlus, Shield, User, Loader2, Link2, Copy, MessageCircle, RefreshCw } from 'lucide-react'
import { buildStaffInviteWhatsAppUrl } from '@/lib/staff-invite'
import { useShop } from '@/components/shared/ShopContext'

type LinkCard = { link: string; phone: string | null; name: string; role: string }

export default function StaffPage() {
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<'manager' | 'cashier'>('cashier')
  const [linkCard, setLinkCard] = useState<LinkCard | null>(null)

  const utils = trpc.useUtils()
  const { shopName } = useShop()
  const { data: staffList, isLoading } = trpc.staff.list.useQuery()

  const inviteMutation = trpc.staff.invite.useMutation({
    onSuccess: (data) => {
      if (data.link) {
        setLinkCard({
          link: data.link,
          phone: data.staff.phone ?? phone ?? null,
          name: data.staff.name ?? name,
          role: data.staff.role,
        })
        toast.success('Invite link ready hai. WhatsApp par bhej do.')
      } else {
        toast.success('Staff member updated!')
      }
      setEmail('')
      setPhone('')
      setName('')
      setRole('cashier')
      utils.staff.list.invalidate()
    },
    onError: (err) => toast.error(err.message)
  })

  const resendMutation = trpc.staff.resendInvite.useMutation({
    onSuccess: (data, variables) => {
      const member = staffList?.find((s) => s.id === variables.id)
      setLinkCard({
        link: data.link,
        phone: member?.phone ?? null,
        name: member?.name ?? '',
        role: member?.role ?? 'cashier',
      })
      toast.success('Naya invite link ready hai.')
      utils.staff.list.invalidate()
    },
    onError: (err) => toast.error(err.message)
  })

  const removeMutation = trpc.staff.remove.useMutation({
    onSuccess: () => {
      toast.success('Staff member removed')
      utils.staff.list.invalidate()
    },
    onError: (err) => toast.error(err.message)
  })

  const updateRoleMutation = trpc.staff.updateRole.useMutation({
    onSuccess: () => {
      toast.success('Role updated')
      utils.staff.list.invalidate()
    },
    onError: (err) => toast.error(err.message)
  })

  const reactivateMutation = trpc.staff.reactivate.useMutation({
    onSuccess: () => {
      toast.success('Staff member reactivated')
      utils.staff.list.invalidate()
    },
    onError: (err) => toast.error(err.message)
  })

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email && !phone) return toast.error('Email ya phone, kam se kam ek chahiye')
    if (phone && phone.replace(/\D/g, '').length < 10) return toast.error('Phone number sahi likho')
    inviteMutation.mutate({
      email: email || undefined,
      phone: phone || undefined,
      name: name || undefined,
      role,
    })
  }

  const copyLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link)
      toast.success('Link copy ho gaya')
    } catch {
      toast.error('Copy nahi hua. Link ko select karke copy karo.')
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
          Staff & Roles
        </h1>
        <p className="text-sm text-gray-400 dark:text-[#98989D] mt-0.5">
          Manage who has access to your shop and what they can do.
        </p>
      </div>

      {/* Invite Form */}
      <form onSubmit={handleInvite} className="bg-white dark:bg-[#1C1C1E] border border-gray-100 dark:border-[#38383A] p-6 rounded-3xl ios-shadow">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-[#1B7A4A]" /> Invite Staff
        </h2>
        <p className="text-sm text-gray-400 dark:text-[#98989D] mb-4">
          Invite link banta hai, koi email nahi jata. Link WhatsApp par bhejo, staff khud apna password set karega.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-xs font-bold text-gray-400 dark:text-[#98989D] uppercase tracking-wider mb-2">Name</label>
            <input
              type="text"
              placeholder="e.g. Rahul"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-gray-50 dark:bg-[#2C2C2E] border border-gray-100 dark:border-[#38383A] text-gray-900 dark:text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#1B7A4A]/20 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 dark:text-[#98989D] uppercase tracking-wider mb-2">Email</label>
            <input
              type="email"
              placeholder="rahul@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-gray-50 dark:bg-[#2C2C2E] border border-gray-100 dark:border-[#38383A] text-gray-900 dark:text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#1B7A4A]/20 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 dark:text-[#98989D] uppercase tracking-wider mb-2">Phone (WhatsApp)</label>
            <input
              type="tel"
              placeholder="98765 43210"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="w-full bg-gray-50 dark:bg-[#2C2C2E] border border-gray-100 dark:border-[#38383A] text-gray-900 dark:text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#1B7A4A]/20 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 dark:text-[#98989D] uppercase tracking-wider mb-2">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'manager' | 'cashier')}
              className="w-full bg-gray-50 dark:bg-[#2C2C2E] border border-gray-100 dark:border-[#38383A] text-gray-900 dark:text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#1B7A4A]/20 transition-all appearance-none"
            >
              <option value="cashier">Cashier (Billing Only)</option>
              <option value="manager">Manager (Billing + Analytics + Inventory)</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={inviteMutation.isPending}
          className="w-full md:w-auto px-6 py-3 bg-[#1B7A4A] hover:bg-[#155F3A] text-white font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {inviteMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Link2 className="w-5 h-5" /> Invite Link Banao</>}
        </button>
      </form>

      {/* Fresh invite link card */}
      {linkCard ? (
        <div className="bg-[#1B7A4A]/5 dark:bg-[#25D366]/10 border border-[#1B7A4A]/20 dark:border-[#25D366]/20 p-6 rounded-3xl">
          <h2 className="text-base font-bold text-gray-900 dark:text-white mb-1">
            {linkCard.name ? `${linkCard.name} ka invite link` : 'Invite link ready hai'}
          </h2>
          <p className="text-sm text-gray-500 dark:text-[#98989D] mb-4">
            Ye link 72 ghante valid hai aur sirf ek baar chalega. Naya link banate hi purana band ho jayega.
          </p>
          <div className="flex flex-col md:flex-row gap-3">
            <code className="flex-1 min-w-0 truncate bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] rounded-xl px-4 py-3 text-sm text-gray-700 dark:text-gray-200">
              {linkCard.link}
            </code>
            <div className="flex gap-3">
              <button
                onClick={() => copyLink(linkCard.link)}
                className="px-4 py-3 bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] text-gray-800 dark:text-gray-100 font-bold rounded-xl flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
              >
                <Copy className="w-4 h-4" /> Copy
              </button>
              {buildStaffInviteWhatsAppUrl(linkCard.phone, shopName, linkCard.role, linkCard.link) ? (
                <a
                  href={buildStaffInviteWhatsAppUrl(linkCard.phone, shopName, linkCard.role, linkCard.link)!}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-3 bg-[#1B7A4A] hover:bg-[#155F3A] text-white font-bold rounded-xl flex items-center gap-2 transition-colors"
                >
                  <MessageCircle className="w-4 h-4" /> WhatsApp
                </a>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* Staff List */}
      <div className="bg-white dark:bg-[#1C1C1E] border border-gray-100 dark:border-[#38383A] rounded-3xl ios-shadow overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-[#38383A]">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Team Members</h2>
        </div>
        
        {isLoading ? (
          <div className="p-10 text-center text-gray-400 animate-pulse">Loading...</div>
        ) : staffList?.length === 0 ? (
          <div className="p-10 text-center text-gray-400">No staff members yet.</div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-[#38383A]">
            {staffList?.map((staff) => (
              <div key={staff.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-[#2C2C2E] flex items-center justify-center">
                    {staff.role === 'manager' ? <Shield className="w-6 h-6 text-orange-500" /> : <User className="w-6 h-6 text-blue-500" />}
                  </div>
                  <div>
                    <div className="font-bold text-gray-900 dark:text-white">
                      {staff.name || 'Unnamed Staff'}
                      {staff.status === 'invited' && <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">Pending Invite</span>}
                      {staff.status === 'active' && <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">Active</span>}
                      {staff.status === 'disabled' && <span className="ml-2 text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">Disabled</span>}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-[#98989D]">{staff.email || staff.phone || ''}</div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {staff.role === 'owner' ? (
                    <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Owner</span>
                  ) : staff.status === 'disabled' ? (
                    <button
                      onClick={() => reactivateMutation.mutate({ id: staff.id })}
                      disabled={reactivateMutation.isPending}
                      className="px-3 py-1.5 text-sm font-bold text-[#1B7A4A] bg-[#1B7A4A]/10 hover:bg-[#1B7A4A]/20 rounded-lg transition-colors disabled:opacity-50"
                    >
                      Reactivate
                    </button>
                  ) : (
                  <>
                  {staff.status === 'invited' ? (
                    <button
                      onClick={() => resendMutation.mutate({ id: staff.id })}
                      disabled={resendMutation.isPending}
                      className="px-3 py-1.5 text-sm font-bold text-[#1B7A4A] bg-[#1B7A4A]/10 hover:bg-[#1B7A4A]/20 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Resend link
                    </button>
                  ) : null}
                  <select
                    value={staff.role}
                    onChange={(e) => updateRoleMutation.mutate({ id: staff.id, role: e.target.value as 'manager'|'cashier' })}
                    disabled={updateRoleMutation.isPending}
                    className="bg-transparent text-sm font-bold text-gray-700 dark:text-gray-300 focus:outline-none cursor-pointer"
                  >
                    <option value="cashier">Cashier</option>
                    <option value="manager">Manager</option>
                  </select>

                  <button
                    onClick={() => {
                      toast('Confirm Removal', {
                        description: 'Are you sure you want to remove this staff member?',
                        action: {
                          label: 'Yes, Remove',
                          onClick: () => removeMutation.mutate({ id: staff.id })
                        },
                        cancel: { label: 'Cancel', onClick: () => {} }
                      })
                    }}
                    disabled={removeMutation.isPending}
                    aria-label={`${staff.name || staff.email} ko team se hatao`}
                    className="tap p-2 min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors"
                    title="Remove Staff"
                  >
                    <Trash2 className="w-5 h-5" aria-hidden="true" />
                  </button>
                  </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
