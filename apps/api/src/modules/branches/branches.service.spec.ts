import { Test, TestingModule } from '@nestjs/testing'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { BranchesService } from './branches.service'
import { PrismaService } from '../../prisma/prisma.service'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const TENANT_ID  = 'ten_001'
const BRANCH_ID  = 'br_default'
const OTHER_BRANCH_ID = 'br_other'
const PRO_ID     = 'pro_001'

// ─────────────────────────────────────────────────────────────────────────────
// resolveBranchId + requireProfessionalInBranch — these are the two helpers
// the slot engine and the appointments service rely on. They are tiny but
// load-bearing: a regression here means either the wrong sucursal gets
// silently picked, or a multi-branch tenant double-books a professional
// across sucursales. The tests cover every branch (pun intended) explicitly.
// ─────────────────────────────────────────────────────────────────────────────

describe('BranchesService — phase 2 helpers', () => {
  let service: BranchesService

  const mockPrisma = {
    branch:             { findFirst: jest.fn(), findMany: jest.fn() },
    professionalBranch: { findUnique: jest.fn() },
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BranchesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile()

    service = module.get<BranchesService>(BranchesService)
    jest.clearAllMocks()
  })

  // ── resolveBranchId ────────────────────────────────────────────────────────

  describe('resolveBranchId', () => {
    describe('explicit branchId path', () => {
      it('returns the requested branchId when it exists, belongs to the tenant and is active', async () => {
        mockPrisma.branch.findFirst.mockResolvedValue({ id: BRANCH_ID })

        const result = await service.resolveBranchId(TENANT_ID, BRANCH_ID)

        expect(result).toBe(BRANCH_ID)
        expect(mockPrisma.branch.findFirst).toHaveBeenCalledWith({
          where:  { id: BRANCH_ID, tenantId: TENANT_ID, isActive: true },
          select: { id: true },
        })
      })

      it('throws NotFoundException when the branch does not exist', async () => {
        mockPrisma.branch.findFirst.mockResolvedValue(null)

        await expect(service.resolveBranchId(TENANT_ID, 'br_missing'))
          .rejects.toThrow(NotFoundException)
      })

      it('throws NotFoundException when the branch belongs to another tenant', async () => {
        // findFirst includes tenantId in the where clause, so a foreign
        // branch returns null exactly like a missing one — both surface as
        // 404 to avoid leaking the existence of cross-tenant rows.
        mockPrisma.branch.findFirst.mockResolvedValue(null)

        await expect(service.resolveBranchId('other_tenant', BRANCH_ID))
          .rejects.toThrow(NotFoundException)
      })

      it('throws NotFoundException when the branch is inactive', async () => {
        mockPrisma.branch.findFirst.mockResolvedValue(null)

        await expect(service.resolveBranchId(TENANT_ID, BRANCH_ID))
          .rejects.toThrow(NotFoundException)
      })

      it('does not consult findMany when an explicit branchId is provided', async () => {
        mockPrisma.branch.findFirst.mockResolvedValue({ id: BRANCH_ID })

        await service.resolveBranchId(TENANT_ID, BRANCH_ID)

        expect(mockPrisma.branch.findMany).not.toHaveBeenCalled()
      })
    })

    describe('fallback path (no branchId provided)', () => {
      it('returns the only active branch when the tenant has exactly one', async () => {
        mockPrisma.branch.findMany.mockResolvedValue([{ id: BRANCH_ID }])

        const result = await service.resolveBranchId(TENANT_ID)

        expect(result).toBe(BRANCH_ID)
      })

      it('also falls back when an empty/null branchId is passed (defensive)', async () => {
        mockPrisma.branch.findMany.mockResolvedValue([{ id: BRANCH_ID }])

        const result = await service.resolveBranchId(TENANT_ID, undefined)

        expect(result).toBe(BRANCH_ID)
      })

      it('throws BadRequestException when the tenant has zero active branches', async () => {
        mockPrisma.branch.findMany.mockResolvedValue([])

        await expect(service.resolveBranchId(TENANT_ID))
          .rejects.toThrow(BadRequestException)
      })

      it('throws BadRequestException when the tenant has multiple active branches', async () => {
        mockPrisma.branch.findMany.mockResolvedValue([
          { id: BRANCH_ID },
          { id: OTHER_BRANCH_ID },
        ])

        await expect(service.resolveBranchId(TENANT_ID))
          .rejects.toThrow(BadRequestException)
      })

      it('uses the actual count of active branches, not Tenant.hasMultipleBranches', async () => {
        // The fallback only fires when count === 1. We simulate a tenant
        // mid-migration that has two branches but hasMultipleBranches is
        // still false in the UI hint — the helper must NOT silently pick one.
        mockPrisma.branch.findMany.mockResolvedValue([
          { id: BRANCH_ID },
          { id: OTHER_BRANCH_ID },
        ])

        await expect(service.resolveBranchId(TENANT_ID))
          .rejects.toThrow(BadRequestException)
      })

      it('queries with isActive: true so deactivated branches do not count', async () => {
        mockPrisma.branch.findMany.mockResolvedValue([{ id: BRANCH_ID }])

        await service.resolveBranchId(TENANT_ID)

        expect(mockPrisma.branch.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { tenantId: TENANT_ID, isActive: true },
          }),
        )
      })
    })
  })

  // ── requireProfessionalInBranch ────────────────────────────────────────────

  describe('requireProfessionalInBranch', () => {
    it('resolves silently when the professional is linked to the branch', async () => {
      mockPrisma.professionalBranch.findUnique.mockResolvedValue({ professionalId: PRO_ID })

      await expect(service.requireProfessionalInBranch(BRANCH_ID, PRO_ID))
        .resolves.toBeUndefined()

      expect(mockPrisma.professionalBranch.findUnique).toHaveBeenCalledWith({
        where:  { professionalId_branchId: { professionalId: PRO_ID, branchId: BRANCH_ID } },
        select: { professionalId: true },
      })
    })

    it('throws BadRequestException when the professional is not linked to the branch', async () => {
      mockPrisma.professionalBranch.findUnique.mockResolvedValue(null)

      await expect(service.requireProfessionalInBranch(BRANCH_ID, PRO_ID))
        .rejects.toThrow(BadRequestException)
    })
  })
})
