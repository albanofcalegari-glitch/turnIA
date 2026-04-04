import { ExecutionContext, ForbiddenException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { RolesGuard } from './roles.guard'
import { PrismaService } from '../../prisma/prisma.service'
import { TenantRole } from '@turnia/shared'
import { ROLES_KEY } from '../decorators/roles.decorator'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const TENANT_ID = 'ten_001'
const USER_ID   = 'usr_001'

/**
 * Builds a minimal ExecutionContext mock.
 * req.user and req.tenantId drive most of the guard logic.
 */
function makeContext(overrides: {
  user?:     Record<string, unknown> | null
  tenantId?: string
}): ExecutionContext {
  const req = {
    user:     overrides.user     ?? { sub: USER_ID, isSuperAdmin: false },
    tenantId: overrides.tenantId ?? TENANT_ID,
  }
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler:   () => ({}),
    getClass:     () => ({}),
  } as unknown as ExecutionContext
}

// ─────────────────────────────────────────────────────────────────────────────
// Test setup
// ─────────────────────────────────────────────────────────────────────────────

describe('RolesGuard', () => {
  let guard:      RolesGuard
  let reflector:  { getAllAndOverride: jest.Mock }
  let mockPrisma: { tenantUser: { findUnique: jest.Mock } }

  beforeEach(() => {
    reflector  = { getAllAndOverride: jest.fn() }
    mockPrisma = { tenantUser: { findUnique: jest.fn() } }

    guard = new RolesGuard(
      reflector  as unknown as Reflector,
      mockPrisma as unknown as PrismaService,
    )
  })

  // ── No roles required ─────────────────────────────────────────────────────

  it('returns true when no @Roles decorator is present (undefined)', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined)

    const result = await guard.canActivate(makeContext({}))

    expect(result).toBe(true)
    expect(mockPrisma.tenantUser.findUnique).not.toHaveBeenCalled()
  })

  it('returns true when @Roles decorator is an empty array', async () => {
    reflector.getAllAndOverride.mockReturnValue([])

    const result = await guard.canActivate(makeContext({}))

    expect(result).toBe(true)
    expect(mockPrisma.tenantUser.findUnique).not.toHaveBeenCalled()
  })

  // ── SuperAdmin bypass ─────────────────────────────────────────────────────

  it('returns true for isSuperAdmin regardless of required roles', async () => {
    reflector.getAllAndOverride.mockReturnValue([TenantRole.ADMIN])

    const result = await guard.canActivate(
      makeContext({ user: { sub: USER_ID, isSuperAdmin: true } }),
    )

    expect(result).toBe(true)
    // Must NOT hit the DB — superadmin bypass should be a shortcut
    expect(mockPrisma.tenantUser.findUnique).not.toHaveBeenCalled()
  })

  // ── Role lookup ───────────────────────────────────────────────────────────

  it('queries tenantUser with the correct userId and tenantId', async () => {
    reflector.getAllAndOverride.mockReturnValue([TenantRole.ADMIN])
    mockPrisma.tenantUser.findUnique.mockResolvedValue({ role: 'ADMIN' })

    await guard.canActivate(makeContext({}))

    expect(mockPrisma.tenantUser.findUnique).toHaveBeenCalledWith({
      where:  { userId_tenantId: { userId: USER_ID, tenantId: TENANT_ID } },
      select: { role: true },
    })
  })

  it('returns true when user has the required role in the tenant', async () => {
    reflector.getAllAndOverride.mockReturnValue([TenantRole.ADMIN])
    mockPrisma.tenantUser.findUnique.mockResolvedValue({ role: 'ADMIN' })

    const result = await guard.canActivate(makeContext({}))

    expect(result).toBe(true)
  })

  it('returns true when user has any of multiple required roles', async () => {
    reflector.getAllAndOverride.mockReturnValue([TenantRole.ADMIN, TenantRole.PROFESSIONAL])
    mockPrisma.tenantUser.findUnique.mockResolvedValue({ role: 'PROFESSIONAL' })

    const result = await guard.canActivate(makeContext({}))

    expect(result).toBe(true)
  })

  // ── Access denied ─────────────────────────────────────────────────────────

  it('throws ForbiddenException when user has wrong role', async () => {
    reflector.getAllAndOverride.mockReturnValue([TenantRole.ADMIN])
    mockPrisma.tenantUser.findUnique.mockResolvedValue({ role: 'CLIENT' })

    await expect(guard.canActivate(makeContext({})))
      .rejects.toThrow(ForbiddenException)
  })

  it('throws ForbiddenException when user has no membership in the tenant', async () => {
    reflector.getAllAndOverride.mockReturnValue([TenantRole.ADMIN])
    mockPrisma.tenantUser.findUnique.mockResolvedValue(null)

    await expect(guard.canActivate(makeContext({})))
      .rejects.toThrow(ForbiddenException)
  })

  it('throws ForbiddenException when tenantId is missing from request', async () => {
    reflector.getAllAndOverride.mockReturnValue([TenantRole.ADMIN])

    await expect(guard.canActivate(makeContext({ tenantId: undefined })))
      .rejects.toThrow(ForbiddenException)
  })

  it('throws ForbiddenException when req.user is null (no JWT)', async () => {
    reflector.getAllAndOverride.mockReturnValue([TenantRole.ADMIN])

    await expect(guard.canActivate(makeContext({ user: null })))
      .rejects.toThrow(ForbiddenException)
  })

  // ── Reflector metadata key ────────────────────────────────────────────────

  it(`reads roles from the '${ROLES_KEY}' metadata key`, async () => {
    reflector.getAllAndOverride.mockReturnValue([TenantRole.ADMIN])
    mockPrisma.tenantUser.findUnique.mockResolvedValue({ role: 'ADMIN' })

    await guard.canActivate(makeContext({}))

    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
      ROLES_KEY,
      expect.any(Array),
    )
  })
})
