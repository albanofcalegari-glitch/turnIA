import { Test, TestingModule } from '@nestjs/testing'
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { ProfessionalsService } from './professionals.service'
import { PrismaService } from '../../prisma/prisma.service'
import { CreateProfessionalDto } from './dto/create-professional.dto'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const TENANT_ID  = 'ten_001'
const CALLER_ID  = 'usr_admin'
const USER_ID    = 'usr_staff'
const PRO_ID     = 'pro_001'
const SVC_ID     = 'svc_001'
const BRANCH_ID  = 'br_001'

// ─────────────────────────────────────────────────────────────────────────────
// Factories
// ─────────────────────────────────────────────────────────────────────────────

function makeProfessional(overrides: Record<string, unknown> = {}) {
  return {
    id:                   PRO_ID,
    tenantId:             TENANT_ID,
    userId:               CALLER_ID,
    displayName:          'Ana García',
    color:                null,
    acceptsOnlineBooking: true,
    isActive:             true,
    user: { id: CALLER_ID, firstName: 'Ana', lastName: 'García', email: 'ana@test.com' },
    ...overrides,
  }
}

function makeDto(overrides: Partial<CreateProfessionalDto> = {}): CreateProfessionalDto {
  return { displayName: 'Ana García', ...overrides }
}

function makePrismaError(code: string) {
  return new Prisma.PrismaClientKnownRequestError('DB error', {
    code,
    clientVersion: '5.0.0',
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Test setup
// ─────────────────────────────────────────────────────────────────────────────

describe('ProfessionalsService', () => {
  let service: ProfessionalsService

  const mockPrisma = {
    user:                { findUnique: jest.fn() },
    tenantUser:          { findUnique: jest.fn() },
    professional:        { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
    branch:              { findMany: jest.fn() },
    professionalBranch:  { createMany: jest.fn(), deleteMany: jest.fn() },
    service:             { findFirst: jest.fn() },
    professionalService: { findUnique: jest.fn(), create: jest.fn(), delete: jest.fn() },
    $transaction:         jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfessionalsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile()

    service = module.get<ProfessionalsService>(ProfessionalsService)
    jest.clearAllMocks()
    mockPrisma.$transaction.mockImplementation(async (cb: any) => cb(mockPrisma))
  })

  // ── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    beforeEach(() => {
      // Default happy-path: user exists, is a tenant member
      mockPrisma.user.findUnique.mockResolvedValue({ id: CALLER_ID })
      mockPrisma.tenantUser.findUnique.mockResolvedValue({ role: 'ADMIN' })
      mockPrisma.professional.create.mockResolvedValue(makeProfessional())
      mockPrisma.branch.findMany.mockResolvedValue([{ id: BRANCH_ID }])
      mockPrisma.professionalBranch.createMany.mockResolvedValue({ count: 1 })
    })

    it('creates an unlinked professional when dto.userId is not provided', async () => {
      await service.create(TENANT_ID, CALLER_ID, makeDto())

      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled()
      expect(mockPrisma.professional.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: null }),
        }),
      )
    })

    it('uses dto.userId when explicitly provided', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: USER_ID })
      mockPrisma.tenantUser.findUnique.mockResolvedValue({ role: 'PROFESSIONAL' })

      await service.create(TENANT_ID, CALLER_ID, makeDto({ userId: USER_ID }))

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where:  { id: USER_ID },
        select: { id: true },
      })
      expect(mockPrisma.tenantUser.findUnique).toHaveBeenCalledWith({
        where:  { userId_tenantId: { userId: USER_ID, tenantId: TENANT_ID } },
        select: { role: true },
      })
    })

    it('passes displayName, color, acceptsOnlineBooking to prisma.create', async () => {
      await service.create(
        TENANT_ID, CALLER_ID,
        makeDto({ displayName: 'Barber Joe', color: '#FF5722', acceptsOnlineBooking: false }),
      )

      expect(mockPrisma.professional.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId:             TENANT_ID,
            userId:               null,
            displayName:          'Barber Joe',
            color:                '#FF5722',
            acceptsOnlineBooking: false,
          }),
        }),
      )
    })

    it('defaults acceptsOnlineBooking to true when not provided', async () => {
      await service.create(TENANT_ID, CALLER_ID, makeDto())

      expect(mockPrisma.professional.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ acceptsOnlineBooking: true }),
        }),
      )
    })

    it('throws NotFoundException when user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)

      await expect(service.create(TENANT_ID, CALLER_ID, makeDto({ userId: USER_ID })))
        .rejects.toThrow(NotFoundException)
    })

    it('throws BadRequestException when user is not a tenant member', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: CALLER_ID })
      mockPrisma.tenantUser.findUnique.mockResolvedValue(null)

      await expect(service.create(TENANT_ID, CALLER_ID, makeDto({ userId: CALLER_ID })))
        .rejects.toThrow(BadRequestException)
    })

    it('throws ConflictException when userId already has a professional (P2002)', async () => {
      mockPrisma.professional.create.mockRejectedValue(makePrismaError('P2002'))

      await expect(service.create(TENANT_ID, CALLER_ID, makeDto()))
        .rejects.toThrow(ConflictException)
    })

    it('re-throws unexpected DB errors without wrapping', async () => {
      mockPrisma.professional.create.mockRejectedValue(new Error('unexpected'))

      await expect(service.create(TENANT_ID, CALLER_ID, makeDto()))
        .rejects.toThrow('unexpected')
    })
  })

  // ── addService ────────────────────────────────────────────────────────────

  describe('addService', () => {
    beforeEach(() => {
      mockPrisma.professional.findFirst.mockResolvedValue({ id: PRO_ID })
      mockPrisma.service.findFirst.mockResolvedValue({ id: SVC_ID, name: 'Corte' })
      mockPrisma.professionalService.findUnique.mockResolvedValue(null)
      mockPrisma.professionalService.create.mockResolvedValue({
        professionalId: PRO_ID,
        serviceId:      SVC_ID,
      })
    })

    it('creates the link when both entities exist in the tenant', async () => {
      const result = await service.addService(TENANT_ID, PRO_ID, SVC_ID)

      expect(result).toEqual({ professionalId: PRO_ID, serviceId: SVC_ID })
      expect(mockPrisma.professionalService.create).toHaveBeenCalledWith({
        data: { professionalId: PRO_ID, serviceId: SVC_ID },
      })
    })

    it('validates professional against tenantId', async () => {
      await service.addService(TENANT_ID, PRO_ID, SVC_ID)

      expect(mockPrisma.professional.findFirst).toHaveBeenCalledWith({
        where:  { id: PRO_ID, tenantId: TENANT_ID },
        select: { id: true },
      })
    })

    it('validates service against tenantId and isActive', async () => {
      await service.addService(TENANT_ID, PRO_ID, SVC_ID)

      expect(mockPrisma.service.findFirst).toHaveBeenCalledWith({
        where:  { id: SVC_ID, tenantId: TENANT_ID, isActive: true },
        select: { id: true, name: true },
      })
    })

    it('throws NotFoundException when professional does not exist in tenant', async () => {
      mockPrisma.professional.findFirst.mockResolvedValue(null)

      await expect(service.addService(TENANT_ID, PRO_ID, SVC_ID))
        .rejects.toThrow(NotFoundException)
    })

    it('throws NotFoundException when service does not exist in tenant', async () => {
      mockPrisma.service.findFirst.mockResolvedValue(null)

      await expect(service.addService(TENANT_ID, PRO_ID, SVC_ID))
        .rejects.toThrow(NotFoundException)
    })

    it('throws NotFoundException when service is inactive', async () => {
      // findFirst returns null when isActive:true filter excludes the row
      mockPrisma.service.findFirst.mockResolvedValue(null)

      await expect(service.addService(TENANT_ID, PRO_ID, SVC_ID))
        .rejects.toThrow(NotFoundException)
    })

    it('throws ConflictException when service is already linked', async () => {
      mockPrisma.professionalService.findUnique.mockResolvedValue({
        professionalId: PRO_ID,
        serviceId:      SVC_ID,
      })

      await expect(service.addService(TENANT_ID, PRO_ID, SVC_ID))
        .rejects.toThrow(ConflictException)
    })

    it('does not call professionalService.create when link already exists', async () => {
      mockPrisma.professionalService.findUnique.mockResolvedValue({ professionalId: PRO_ID, serviceId: SVC_ID })

      await expect(service.addService(TENANT_ID, PRO_ID, SVC_ID)).rejects.toThrow()
      expect(mockPrisma.professionalService.create).not.toHaveBeenCalled()
    })

    it('prevents cross-tenant service linking (service belongs to different tenant)', async () => {
      // Service query with wrong tenantId returns null — same as not found
      mockPrisma.service.findFirst.mockResolvedValue(null)

      await expect(service.addService('other_tenant', PRO_ID, SVC_ID))
        .rejects.toThrow(NotFoundException)
    })
  })

  // ── removeService ─────────────────────────────────────────────────────────

  describe('removeService', () => {
    beforeEach(() => {
      mockPrisma.professional.findFirst.mockResolvedValue({ id: PRO_ID })
      mockPrisma.professionalService.findUnique.mockResolvedValue({
        professionalId: PRO_ID, serviceId: SVC_ID,
      })
      mockPrisma.professionalService.delete.mockResolvedValue({})
    })

    it('deletes the link and returns confirmation', async () => {
      const result = await service.removeService(TENANT_ID, PRO_ID, SVC_ID)

      expect(result).toEqual({ deleted: true, professionalId: PRO_ID, serviceId: SVC_ID })
    })

    it('throws NotFoundException when professional not in tenant', async () => {
      mockPrisma.professional.findFirst.mockResolvedValue(null)

      await expect(service.removeService(TENANT_ID, PRO_ID, SVC_ID))
        .rejects.toThrow(NotFoundException)
    })

    it('throws NotFoundException when link does not exist', async () => {
      mockPrisma.professionalService.findUnique.mockResolvedValue(null)

      await expect(service.removeService(TENANT_ID, PRO_ID, SVC_ID))
        .rejects.toThrow(NotFoundException)
    })
  })
})
