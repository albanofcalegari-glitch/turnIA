import { Test, TestingModule } from '@nestjs/testing'
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common'
import { Prisma, AppointmentStatus } from '@prisma/client'
import { AppointmentsService } from './appointments.service'
import { PrismaService } from '../../prisma/prisma.service'
import { SchedulesService } from '../schedules/schedules.service'
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const TENANT_ID      = 'ten_001'
const PRO_ID         = 'pro_001'
const NEW_PRO_ID     = 'pro_002'
const CLIENT_ID      = 'cli_001'
const SVC_ID         = 'svc_001'
const NEW_SVC_ID     = 'svc_002'
const ORIGINAL_ID    = 'appt_original'
const NEW_APPT_ID    = 'appt_new'

// ─────────────────────────────────────────────────────────────────────────────
// Factories
// ─────────────────────────────────────────────────────────────────────────────

function makeScheduleRules(overrides: Record<string, unknown> = {}) {
  return {
    allowGuestBooking:   true,
    autoConfirm:         true,
    minAdvanceMinutes:   60,
    bookingWindowDays:   30,
    slotDurationMinutes: 15,
    cancelHoursMin:      24,
    rescheduleHoursMin:  24,
    requireConfirmation: false,
    ...overrides,
  }
}

function makeProfessional(overrides: Record<string, unknown> = {}) {
  return {
    id:                   PRO_ID,
    tenantId:             TENANT_ID,
    isActive:             true,
    acceptsOnlineBooking: true,
    tenant: {
      id:            TENANT_ID,
      timezone:      'America/Argentina/Buenos_Aires',
      scheduleRules: makeScheduleRules(),
    },
    ...overrides,
  }
}

function makeOriginalAppointment(overrides: Record<string, unknown> = {}) {
  const startAt = new Date(Date.now() + 2 * 60 * 60 * 1000)  // +2h
  const endAt   = new Date(startAt.getTime() + 35 * 60_000)
  return {
    id:              ORIGINAL_ID,
    tenantId:        TENANT_ID,
    clientId:        CLIENT_ID,
    professionalId:  PRO_ID,
    status:          AppointmentStatus.CONFIRMED,
    startAt,
    endAt,
    totalMinutes:    35,
    totalPrice:      2500,
    notes:           null,
    guestName:       null,
    guestEmail:      null,
    guestPhone:      null,
    rescheduledFromId: null,
    items: [
      {
        id:              'item_001',
        appointmentId:   ORIGINAL_ID,
        serviceId:       SVC_ID,
        serviceName:     'Corte',
        durationMinutes: 30,
        price:           2500,
        order:           0,
      },
    ],
    ...overrides,
  }
}

function makeCreatedAppointment() {
  const startAt = new Date(Date.now() + 5 * 60 * 60 * 1000)   // +5h (new slot)
  const endAt   = new Date(startAt.getTime() + 35 * 60_000)
  return {
    id:                NEW_APPT_ID,
    tenantId:          TENANT_ID,
    clientId:          CLIENT_ID,
    professionalId:    PRO_ID,
    status:            AppointmentStatus.CONFIRMED,
    startAt,
    endAt,
    totalMinutes:      35,
    totalPrice:        2500,
    confirmedAt:       new Date(),
    rescheduledFromId: ORIGINAL_ID,
    items:             [],
    professional:      { id: PRO_ID, displayName: 'Carlos', avatarUrl: null },
    client:            { id: CLIENT_ID, firstName: 'Ana', lastName: 'Garcia', email: 'ana@test.com' },
  }
}

function makeServices() {
  return [
    { id: SVC_ID, name: 'Corte', durationMinutes: 30, bufferBefore: 0, bufferAfter: 5, price: 2500 },
  ]
}

function makeDto(overrides: Partial<RescheduleAppointmentDto> = {}): RescheduleAppointmentDto {
  return {
    startAt: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),  // +5h
    ...overrides,
  }
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

describe('AppointmentsService.reschedule', () => {
  let service: AppointmentsService

  const mockPrisma = {
    appointment:  { findFirst: jest.fn(), findUnique: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn(), findMany: jest.fn() },
    professional: { findFirst: jest.fn() },
    user:         { findUnique: jest.fn() },
    $transaction: jest.fn(),
  }
  const mockSchedules = {
    resolveServices:      jest.fn(),
    computeTotalDuration: jest.fn(),
  }

  // Builds a $transaction mock that calls the callback with a fresh tx object.
  //
  // txFindUniqueStatus — value returned by tx.appointment.findUnique
  //   (the re-read inside the transaction)
  // overlapCount       — overlap count returned inside the tx
  // createResult       — value returned by tx.appointment.create
  function setupTransactionMock(opts: {
    txFindUniqueStatus?: AppointmentStatus | null
    overlapCount?:       number
    createResult?:       unknown
  } = {}) {
    const {
      txFindUniqueStatus = AppointmentStatus.CONFIRMED,
      overlapCount       = 0,
      createResult       = makeCreatedAppointment(),
    } = opts

    const mockTx = {
      appointment: {
        findUnique: jest.fn().mockResolvedValue(
          txFindUniqueStatus !== null ? { status: txFindUniqueStatus } : null,
        ),
        count:  jest.fn().mockResolvedValue(overlapCount),
        create: jest.fn().mockResolvedValue(createResult),
        update: jest.fn().mockResolvedValue({}),
      },
    }

    mockPrisma.$transaction.mockImplementation(
      async (callback: (tx: typeof mockTx) => Promise<unknown>, _opts: unknown) =>
        callback(mockTx),
    )

    return mockTx
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        { provide: PrismaService,    useValue: mockPrisma    },
        { provide: SchedulesService, useValue: mockSchedules },
      ],
    }).compile()

    service = module.get<AppointmentsService>(AppointmentsService)
    jest.clearAllMocks()

    // Default happy-path setup
    mockPrisma.appointment.findFirst.mockResolvedValue(makeOriginalAppointment())
    mockPrisma.professional.findFirst.mockResolvedValue(makeProfessional())
    mockSchedules.resolveServices.mockResolvedValue(makeServices())
    mockSchedules.computeTotalDuration.mockReturnValue(35)
  })

  // ── Pre-transaction validation ─────────────────────────────────────────────

  describe('pre-transaction validation', () => {
    it('throws NotFoundException when appointment does not exist', async () => {
      mockPrisma.appointment.findFirst.mockResolvedValue(null)

      await expect(service.reschedule(TENANT_ID, ORIGINAL_ID, makeDto()))
        .rejects.toThrow(NotFoundException)
    })

    it('throws NotFoundException when appointment belongs to a different tenant', async () => {
      mockPrisma.appointment.findFirst.mockResolvedValue(null)

      await expect(service.reschedule('other_tenant', ORIGINAL_ID, makeDto()))
        .rejects.toThrow(NotFoundException)
    })

    it.each([
      AppointmentStatus.CANCELLED,
      AppointmentStatus.COMPLETED,
      AppointmentStatus.NO_SHOW,
      AppointmentStatus.RESCHEDULED,
    ])('throws BadRequestException for terminal status %s', async (status) => {
      mockPrisma.appointment.findFirst.mockResolvedValue(
        makeOriginalAppointment({ status }),
      )

      await expect(service.reschedule(TENANT_ID, ORIGINAL_ID, makeDto()))
        .rejects.toThrow(BadRequestException)
    })

    it('does NOT throw for PENDING status (reschedulable)', async () => {
      mockPrisma.appointment.findFirst.mockResolvedValue(
        makeOriginalAppointment({ status: AppointmentStatus.PENDING }),
      )
      setupTransactionMock()

      await expect(service.reschedule(TENANT_ID, ORIGINAL_ID, makeDto()))
        .resolves.toBeDefined()
    })

    it('throws NotFoundException when professional does not exist', async () => {
      mockPrisma.professional.findFirst.mockResolvedValue(null)

      await expect(service.reschedule(TENANT_ID, ORIGINAL_ID, makeDto()))
        .rejects.toThrow(NotFoundException)
    })

    it('throws BadRequestException when startAt violates minAdvanceMinutes', async () => {
      const tooSoon = new Date(Date.now() + 30 * 60_000).toISOString()  // only +30m

      await expect(service.reschedule(TENANT_ID, ORIGINAL_ID, makeDto({ startAt: tooSoon })))
        .rejects.toThrow(BadRequestException)
    })

    it('throws BadRequestException when startAt exceeds bookingWindowDays', async () => {
      const tooFar = new Date(Date.now() + 31 * 24 * 60 * 60_000).toISOString()

      await expect(service.reschedule(TENANT_ID, ORIGINAL_ID, makeDto({ startAt: tooFar })))
        .rejects.toThrow(BadRequestException)
    })
  })

  // ── Professional and service resolution ───────────────────────────────────

  describe('professional and service resolution', () => {
    it('uses original professionalId when dto.professionalId is omitted', async () => {
      setupTransactionMock()

      await service.reschedule(TENANT_ID, ORIGINAL_ID, makeDto())

      expect(mockPrisma.professional.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ id: PRO_ID }) }),
      )
    })

    it('uses dto.professionalId when provided', async () => {
      mockPrisma.professional.findFirst.mockResolvedValue(
        makeProfessional({ id: NEW_PRO_ID }),
      )
      setupTransactionMock()

      await service.reschedule(TENANT_ID, ORIGINAL_ID, makeDto({ professionalId: NEW_PRO_ID }))

      expect(mockPrisma.professional.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ id: NEW_PRO_ID }) }),
      )
    })

    it('uses original serviceIds when dto.items is omitted', async () => {
      setupTransactionMock()

      await service.reschedule(TENANT_ID, ORIGINAL_ID, makeDto())

      expect(mockSchedules.resolveServices).toHaveBeenCalledWith(
        TENANT_ID,
        PRO_ID,
        [SVC_ID],
      )
    })

    it('uses dto.items serviceIds when provided', async () => {
      setupTransactionMock()

      await service.reschedule(
        TENANT_ID,
        ORIGINAL_ID,
        makeDto({ items: [{ serviceId: NEW_SVC_ID }] }),
      )

      expect(mockSchedules.resolveServices).toHaveBeenCalledWith(
        TENANT_ID,
        PRO_ID,
        [NEW_SVC_ID],
      )
    })
  })

  // ── Happy path ─────────────────────────────────────────────────────────────

  describe('happy path', () => {
    it('returns the new appointment', async () => {
      const expected = makeCreatedAppointment()
      setupTransactionMock({ createResult: expected })

      const result = await service.reschedule(TENANT_ID, ORIGINAL_ID, makeDto())

      expect(result).toEqual(expected)
    })

    it('creates new appointment with rescheduledFromId = originalId', async () => {
      const mockTx = setupTransactionMock()

      await service.reschedule(TENANT_ID, ORIGINAL_ID, makeDto())

      expect(mockTx.appointment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            rescheduledFromId: ORIGINAL_ID,
          }),
        }),
      )
    })

    it('marks original appointment as RESCHEDULED', async () => {
      const mockTx = setupTransactionMock()

      await service.reschedule(TENANT_ID, ORIGINAL_ID, makeDto())

      expect(mockTx.appointment.update).toHaveBeenCalledWith({
        where: { id: ORIGINAL_ID },
        data:  { status: AppointmentStatus.RESCHEDULED },
      })
    })

    it('carries forward clientId from the original appointment', async () => {
      const mockTx = setupTransactionMock()

      await service.reschedule(TENANT_ID, ORIGINAL_ID, makeDto())

      expect(mockTx.appointment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ clientId: CLIENT_ID }),
        }),
      )
    })

    it('carries forward guestName / guestEmail / guestPhone from guest original', async () => {
      mockPrisma.appointment.findFirst.mockResolvedValue(
        makeOriginalAppointment({
          guestName:  'Ana Garcia',
          guestEmail: 'ana@test.com',
          guestPhone: '1155443322',
        }),
      )
      const mockTx = setupTransactionMock()

      await service.reschedule(TENANT_ID, ORIGINAL_ID, makeDto())

      expect(mockTx.appointment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            guestName:  'Ana Garcia',
            guestEmail: 'ana@test.com',
            guestPhone: '1155443322',
          }),
        }),
      )
    })

    it('stores service snapshots (name, durationMinutes, price) at reschedule time', async () => {
      const mockTx = setupTransactionMock()

      await service.reschedule(TENANT_ID, ORIGINAL_ID, makeDto())

      expect(mockTx.appointment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            items: {
              create: [
                expect.objectContaining({
                  serviceId:       SVC_ID,
                  serviceName:     'Corte',
                  durationMinutes: 30,
                  price:           2500,
                  order:           0,
                }),
              ],
            },
          }),
        }),
      )
    })

    it('computes endAt correctly from totalMinutes', async () => {
      const dto     = makeDto()
      const startAt = new Date(dto.startAt)
      const mockTx  = setupTransactionMock()

      await service.reschedule(TENANT_ID, ORIGINAL_ID, dto)

      const createCall = mockTx.appointment.create.mock.calls[0][0]
      const { startAt: calledStart, endAt } = createCall.data as { startAt: Date; endAt: Date }

      expect(endAt.getTime() - calledStart.getTime()).toBe(35 * 60_000)
    })

    it('excludes original appointment from overlap count', async () => {
      const mockTx = setupTransactionMock()

      await service.reschedule(TENANT_ID, ORIGINAL_ID, makeDto())

      expect(mockTx.appointment.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { not: ORIGINAL_ID },
          }),
        }),
      )
    })

    it('re-reads original status inside the transaction (TOCTOU guard)', async () => {
      const mockTx = setupTransactionMock()

      await service.reschedule(TENANT_ID, ORIGINAL_ID, makeDto())

      expect(mockTx.appointment.findUnique).toHaveBeenCalledWith({
        where:  { id: ORIGINAL_ID },
        select: { status: true },
      })
    })

    it('passes SERIALIZABLE isolation level to $transaction', async () => {
      setupTransactionMock()

      await service.reschedule(TENANT_ID, ORIGINAL_ID, makeDto())

      expect(mockPrisma.$transaction).toHaveBeenCalledWith(
        expect.any(Function),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )
    })

    it('creates new appointment with CONFIRMED status when autoConfirm=true', async () => {
      const mockTx = setupTransactionMock()

      await service.reschedule(TENANT_ID, ORIGINAL_ID, makeDto())

      expect(mockTx.appointment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status:      AppointmentStatus.CONFIRMED,
            confirmedAt: expect.any(Date),
          }),
        }),
      )
    })

    it('creates new appointment with PENDING status when autoConfirm=false', async () => {
      mockPrisma.professional.findFirst.mockResolvedValue(
        makeProfessional({
          tenant: {
            id:            TENANT_ID,
            timezone:      'America/Argentina/Buenos_Aires',
            scheduleRules: makeScheduleRules({ autoConfirm: false }),
          },
        }),
      )
      const mockTx = setupTransactionMock()

      await service.reschedule(TENANT_ID, ORIGINAL_ID, makeDto())

      expect(mockTx.appointment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status:      AppointmentStatus.PENDING,
            confirmedAt: null,
          }),
        }),
      )
    })
  })

  // ── Conflict detection ─────────────────────────────────────────────────────

  describe('conflict detection', () => {
    it('throws ConflictException when overlap count > 0', async () => {
      setupTransactionMock({ overlapCount: 1 })

      await expect(service.reschedule(TENANT_ID, ORIGINAL_ID, makeDto()))
        .rejects.toThrow(ConflictException)
    })

    it('throws ConflictException with "no longer available" on slot overlap', async () => {
      setupTransactionMock({ overlapCount: 1 })

      await expect(service.reschedule(TENANT_ID, ORIGINAL_ID, makeDto()))
        .rejects.toThrow('no longer available')
    })

    it('translates P2002 to HTTP 409 ConflictException', async () => {
      mockPrisma.$transaction.mockRejectedValue(makePrismaError('P2002'))

      await expect(service.reschedule(TENANT_ID, ORIGINAL_ID, makeDto()))
        .rejects.toThrow(ConflictException)
    })

    it('translates P2034 to HTTP 409 ConflictException', async () => {
      mockPrisma.$transaction.mockRejectedValue(makePrismaError('P2034'))

      await expect(service.reschedule(TENANT_ID, ORIGINAL_ID, makeDto()))
        .rejects.toThrow(ConflictException)
    })

    it('P2034 message suggests retrying', async () => {
      mockPrisma.$transaction.mockRejectedValue(makePrismaError('P2034'))

      await expect(service.reschedule(TENANT_ID, ORIGINAL_ID, makeDto()))
        .rejects.toThrow('try again')
    })

    it('re-throws unexpected DB errors without wrapping', async () => {
      mockPrisma.$transaction.mockRejectedValue(new Error('unexpected DB error'))

      await expect(service.reschedule(TENANT_ID, ORIGINAL_ID, makeDto()))
        .rejects.toThrow('unexpected DB error')
    })
  })

  // ── Concurrent reschedule race condition ───────────────────────────────────

  describe('concurrent reschedule race', () => {
    it('throws BadRequestException when terminal status detected inside transaction', async () => {
      // Outside read: CONFIRMED — passes the pre-tx check.
      // Inside tx:    RESCHEDULED — a concurrent reschedule already committed.
      setupTransactionMock({ txFindUniqueStatus: AppointmentStatus.RESCHEDULED })

      await expect(service.reschedule(TENANT_ID, ORIGINAL_ID, makeDto()))
        .rejects.toThrow(BadRequestException)
    })

    it('throws BadRequestException when original disappears inside transaction (null)', async () => {
      setupTransactionMock({ txFindUniqueStatus: null })

      await expect(service.reschedule(TENANT_ID, ORIGINAL_ID, makeDto()))
        .rejects.toThrow(BadRequestException)
    })

    it('does NOT call appointment.create when terminal detected inside tx', async () => {
      const mockTx = setupTransactionMock({ txFindUniqueStatus: AppointmentStatus.CANCELLED })

      await expect(service.reschedule(TENANT_ID, ORIGINAL_ID, makeDto())).rejects.toThrow()

      expect(mockTx.appointment.create).not.toHaveBeenCalled()
      expect(mockTx.appointment.update).not.toHaveBeenCalled()
    })

    it('does NOT call appointment.update when overlap detected (create never runs)', async () => {
      const mockTx = setupTransactionMock({ overlapCount: 1 })

      await expect(service.reschedule(TENANT_ID, ORIGINAL_ID, makeDto())).rejects.toThrow()

      expect(mockTx.appointment.create).not.toHaveBeenCalled()
      expect(mockTx.appointment.update).not.toHaveBeenCalled()
    })
  })
})
