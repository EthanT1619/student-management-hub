import { beforeEach, describe, expect, it, vi } from 'vitest'

const { rpc } = vi.hoisted(() => ({
  rpc: vi.fn(),
}))

vi.mock('../supabase', () => ({
  supabase: {
    rpc,
  },
}))

import { assertStudentHubAdminClient, checkStudentHubAdmin } from '../hubAccess'

describe('hub admin gate', () => {
  beforeEach(() => {
    rpc.mockReset()
  })

  it('checkStudentHubAdmin maps rpc boolean', async () => {
    rpc.mockResolvedValue({ data: true, error: null })
    await expect(checkStudentHubAdmin()).resolves.toBe(true)
    expect(rpc).toHaveBeenCalledWith('is_student_hub_admin')
  })

  it('assertStudentHubAdminClient throws when not admin', async () => {
    rpc.mockResolvedValue({ data: false, error: null })
    await expect(assertStudentHubAdminClient()).rejects.toThrow(/관리자/)
  })
})
