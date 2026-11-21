'use client'

import { useState } from 'react'
import { trpc } from '@/lib/trpc/client'
import { toast } from 'sonner'
import { Trash2, UserPlus, Shield, User, Loader2 } from 'lucide-react'

export default function StaffPage() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<'manager' | 'cashier'>('cashier')

  const utils = trpc.useUtils()
  const { data: staffList, isLoading } = trpc.staff.list.useQuery()

  const inviteMutation = trpc.staff.invite.useMutation({
    onSuccess: () => {
      toast.success('Staff member invited!')
      setEmail('')
      setName('')
      setRole('cashier')
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
    if (!email) return toast.error('Email is required')
    inviteMutation.mutate({ email, name, role })
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
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-blue-500" /> Invite Staff
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
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
            <label className="block text-xs font-bold text-gray-400 dark:text-[#98989D] uppercase tracking-wider mb-2">Email *</label>
            <input 
              type="email" 
              required
              placeholder="rahul@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
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
          {inviteMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send Invite'}
        </button>
      </form>

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
                    <div className="text-sm text-gray-500 dark:text-[#98989D]">{staff.email}</div>
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
