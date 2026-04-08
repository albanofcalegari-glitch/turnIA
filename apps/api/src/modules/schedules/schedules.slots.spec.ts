import { Test, TestingModule } from '@nestjs/testing'
import { BadRequestException } from '@nestjs/common'
import { SchedulesService } from './schedules.service'
import { PrismaService } from '../../prisma/prisma.service'
import { BranchesService } from '../branches/branches.service'

// ─────────────────────────────────────────────────────────────────────────────
// These tests focus on phase 2 of the branches feature: the slot engine
// must (a) resolve and validate the branch, (b) verify the professional
// atende en esa sucursal, (c) query WorkSchedule scoped to the branch and
// (d) keep the busy-appointment query branch-AGNOSTIC so the same physical
// professional cannot be double-booked across branches.
//
// The pure date/timezone math is already covered by the existing slot
// algorithm tests (when those are added); this file specifically targets
// the branch-related behavior introduced in phase 2.
// ─────────────────────────────────────────────────────────────────────────────

const TENANT_ID  = 'ten_001'
const PRO_ID     = 'pro_001'
const SVC_ID     = 'svc_001'
const BRANCH_A   = 'br_a'
const BRANCH_B   = 'br_b'

function makeProfessional(overrides: Record<string, unknown> = {}) {
  return {
    id:       PRO_ID,
    tenantId: TENANT_ID,
    isActive: true,
    tenant: {
      id:            TENANT_ID,
      timezone:      'America/Argentina/Buenos_Aires',
      scheduleRules: { slotDurationMinutes: 30 },
    },
    ...overrides,
  }
}

function makeService() {
  return [{
    id:              SVC_ID,
    name:            'Corte',
    durationMinutes: 30,
    bufferBefore:    0,
    bufferAfter:     0,
    price:           1500,
  }]
}

describe('SchedulesService.getAvailableSlots — branch handling', () => {
  let service: SchedulesService

  const mockPrisma = {
    professional:      { findFirst: jest.fn() },
    workSchedule:      { findFirst: jest.fn(), findMany: jest.fn() },
    scheduleException: { findMany: jest.fn() },
    appointment:       { findMany: jest.fn() },
    service:           { findMany: jest.fn() },
  }
  const mockBranches = {
    resolveBranchId:             jest.fn(),
    requireProfessionalInBranch: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulesService,
        { provide: PrismaService,    useValue: mockPrisma   },
        { provide: BranchesService,  useValue: mockBranches },
      ],
    }).compile()

    service = module.get<SchedulesService>(SchedulesService)
    jest.clearAllMocks()

    // Default happy path: pro in branch A from 09:00 to 13:00, no exceptions,
    // no existing appointments. Branch resolves to whatever is requested.
    mockBranches.resolveBranchId.mockImplementation(async (_t: string, b?: string) => b ?? BRANCH_A)
    mockBranches.requireProfessionalInBranch.mockResolvedValue(undefined)
    mockPrisma.professional.findFirst.mockResolvedValue(makeProfessional())
    mockPrisma.workSchedule.findFirst.mockResolvedValue({
      startTime: '09:00',
      endTime:   '13:00',
    })
    mockPrisma.scheduleException.findMany.mockResolvedValue([])
    mockPrisma.appointment.findMany.mockResolvedValue([])
    // service.findMany is called by resolveServices internally
    mockPrisma.service.findMany.mockResolvedValue([{
      id:              SVC_ID,
      name:            'Corte',
      durationMinutes: 30,
      bufferBefore:    0,
      bufferAfter:     0,
      price:           1500,
      professionals:   [{ overridePrice: null, overrideDuration: null }],
    }])
  })

  it('resolves branch through BranchesService and includes it in the response', async () => {
    const result = await service.getAvailableSlots(
      TENANT_ID,
      PRO_ID,
      '2026-04-15',  // Wednesday
      [SVC_ID],
      BRANCH_A,
    )

    expect(mockBranches.resolveBranchId).toHaveBeenCalledWith(TENANT_ID, BRANCH_A)
    expect(result.branchId).toBe(BRANCH_A)
  })

  it('verifies the professional atende en la sucursal antes de calcular slots', async () => {
    await service.getAvailableSlots(TENANT_ID, PRO_ID, '2026-04-15', [SVC_ID], BRANCH_A)

    expect(mockBranches.requireProfessionalInBranch).toHaveBeenCalledWith(BRANCH_A, PRO_ID)
  })

  it('rejects when the professional does NOT atender en esa sucursal', async () => {
    mockBranches.requireProfessionalInBranch.mockRejectedValue(
      new BadRequestException('El profesional no atiende en esta sucursal'),
    )

    await expect(
      service.getAvailableSlots(TENANT_ID, PRO_ID, '2026-04-15', [SVC_ID], BRANCH_B),
    ).rejects.toThrow(BadRequestException)
  })

  it('queries WorkSchedule filtered by (professionalId, branchId, dayOfWeek)', async () => {
    await service.getAvailableSlots(TENANT_ID, PRO_ID, '2026-04-15', [SVC_ID], BRANCH_A)

    expect(mockPrisma.workSchedule.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          professionalId: PRO_ID,
          branchId:       BRANCH_A,
          isActive:       true,
        }),
      }),
    )
  })

  it('returns empty NOT_WORKING response when the pro has no schedule for that branch on that day', async () => {
    // Same pro might have a schedule at branch A but not at branch B for a
    // given weekday. The slot engine must return NOT_WORKING for the absent
    // (branch, day) combination, not the union of all branches.
    mockPrisma.workSchedule.findFirst.mockResolvedValue(null)

    const result = await service.getAvailableSlots(
      TENANT_ID,
      PRO_ID,
      '2026-04-15',
      [SVC_ID],
      BRANCH_B,
    )

    expect(result.unavailableReason).toBe('NOT_WORKING')
    expect(result.slots).toEqual([])
    expect(result.branchId).toBe(BRANCH_B)
  })

  it('busy-appointments query is BRANCH-AGNOSTIC (cross-branch double-booking guard)', async () => {
    // CRITICAL: this is the load-bearing test for the entire phase 2 design.
    // The same physical professional cannot be in two sucursales at once,
    // so when we check for existing appointments we must NOT filter by
    // branchId — otherwise a Tuesday 11:00 booking at branch A would not
    // block a Tuesday 11:00 booking at branch B for the same pro.
    await service.getAvailableSlots(TENANT_ID, PRO_ID, '2026-04-15', [SVC_ID], BRANCH_A)

    const appointmentCall = mockPrisma.appointment.findMany.mock.calls[0][0]
    expect(appointmentCall.where).not.toHaveProperty('branchId')
    expect(appointmentCall.where).toEqual(
      expect.objectContaining({
        professionalId: PRO_ID,
      }),
    )
  })

  it('an appointment at branch A removes the corresponding slot from branch B availability', async () => {
    // Wednesday 2026-04-15, work window 09:00–13:00 in BA local time.
    // Tenant timezone is UTC-3 → 09:00 local = 12:00 UTC.
    // We seed an existing appointment 11:00–11:30 local (= 14:00–14:30 UTC)
    // at BRANCH_A. When we query BRANCH_B, that slot must NOT appear, even
    // though the appointment lives at a different sucursal.
    mockPrisma.appointment.findMany.mockResolvedValue([
      {
        startAt: new Date('2026-04-15T14:00:00.000Z'),
        endAt:   new Date('2026-04-15T14:30:00.000Z'),
      },
    ])

    const result = await service.getAvailableSlots(
      TENANT_ID,
      PRO_ID,
      '2026-04-15',
      [SVC_ID],
      BRANCH_B,
    )

    const startsLocal = result.slots.map(s => s.startAt)
    // The 11:00 local slot must NOT be present.
    expect(startsLocal).not.toContain('2026-04-15T14:00:00.000Z')
    // Sanity: other slots (e.g. 09:00 = 12:00 UTC) should still appear.
    expect(startsLocal).toContain('2026-04-15T12:00:00.000Z')
  })

  it('falls back to single active branch when branchId is omitted', async () => {
    mockBranches.resolveBranchId.mockImplementation(async () => BRANCH_A)

    const result = await service.getAvailableSlots(
      TENANT_ID,
      PRO_ID,
      '2026-04-15',
      [SVC_ID],
      // no branchId
    )

    expect(mockBranches.resolveBranchId).toHaveBeenCalledWith(TENANT_ID, undefined)
    expect(result.branchId).toBe(BRANCH_A)
  })
})
