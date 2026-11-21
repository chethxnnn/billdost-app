import { describe, expect, it } from 'vitest'
import { can, capabilitiesFor, isAdminRole } from './roles'

describe('role gates (plan Section 12)', () => {
  it('founder can do everything', () => {
    for (const capability of capabilitiesFor('founder')) {
      expect(can('founder', capability)).toBe(true)
    }
    expect(capabilitiesFor('founder').length).toBeGreaterThanOrEqual(17)
  })

  it('only the founder can unmask customer data', () => {
    expect(can('founder', 'unmask')).toBe(true)
    expect(can('co_founder', 'unmask')).toBe(false)
    expect(can('support', 'unmask')).toBe(false)
    expect(can('finance', 'unmask')).toBe(false)
    expect(can('analyst', 'unmask')).toBe(false)
  })

  it('support can run the floor but not finance or broadcasts', () => {
    expect(can('support', 'applications')).toBe(true)
    expect(can('support', 'shop_setup')).toBe(true)
    expect(can('support', 'activation_actions')).toBe(true)
    expect(can('support', 'issues')).toBe(true)
    expect(can('support', 'finance_view')).toBe(false)
    expect(can('support', 'broadcasts')).toBe(false)
    expect(can('support', 'team_manage')).toBe(false)
    expect(can('support', 'suspend_shop')).toBe(false)
  })

  it('finance sees money, not shop operations', () => {
    expect(can('finance', 'finance_view')).toBe(true)
    expect(can('finance', 'plan_edit')).toBe(true)
    expect(can('finance', 'finance_export')).toBe(true)
    expect(can('finance', 'issues_status')).toBe(true)
    expect(can('finance', 'applications')).toBe(false)
    expect(can('finance', 'shop_setup')).toBe(false)
    expect(can('finance', 'dashboard')).toBe(false)
  })

  it('analyst is read-only on the dashboard', () => {
    expect(can('analyst', 'dashboard')).toBe(true)
    expect(can('analyst', 'shops_view')).toBe(false)
    expect(can('analyst', 'applications')).toBe(false)
    expect(can('analyst', 'team_manage')).toBe(false)
  })

  it('suspend and settings belong to founder and co-founder', () => {
    for (const role of ['founder', 'co_founder'] as const) {
      expect(can(role, 'suspend_shop')).toBe(true)
      expect(can(role, 'settings')).toBe(true)
      expect(can(role, 'audit_view')).toBe(true)
      expect(can(role, 'broadcasts')).toBe(true)
    }
  })

  it('recognises exactly the five roles', () => {
    for (const role of ['founder', 'co_founder', 'support', 'finance', 'analyst']) {
      expect(isAdminRole(role)).toBe(true)
    }
    expect(isAdminRole('owner')).toBe(false)
    expect(isAdminRole('admin')).toBe(false)
    expect(isAdminRole(null)).toBe(false)
    expect(isAdminRole(42)).toBe(false)
  })
})
