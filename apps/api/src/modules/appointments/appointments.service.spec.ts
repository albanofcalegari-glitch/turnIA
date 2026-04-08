import { Test, TestingModule } from '@nestjs/testing'
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common'
import { Prisma, AppointmentStatus } from '@prisma/client'
import { AppointmentsService } from './appointments.service'
import { PrismaService } from '../../prisma/prisma.service'
import { SchedulesService } from '../schedules/schedules.service'
import { BranchesService } from '../branches/branches.service'
import { CreateAppointmentDto } from './dto/create-appointment.dto'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const TENANT_ID  = 'ten_001'
const PRO_ID     = 'pro_001'
const USER_ID    = 'usr_client'   // JWT sub / User entity ID
const CLIENT_ID  = 'cli_001'      // Client entity ID (CRM record)
const SVC_ID     = 'svc_001'
const BRANCH_ID  = 'br_default'   // Resolved by BranchesService.resolveBranchId
const OTHER_BRANCH_ID = 'br_other'

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
    userId:               'usr_pro',
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

function makeUser() {
  return { firstName: 'Juan', lastName: 'Pérez', email: 'juan@test.com' }
}

function makeServices() {
  return [
    {
      id:              SVC_ID,
      name:            'Corte',
      durationMinutes: 30,
      bufferBefore:    0,
      bufferAfter:     5,
      price:           1500,
    },
  ]
}

// totalDuration = 0 (bufferBefore) + 30 (duration) + 5 (bufferAfter) = 35 min
const TOTAL_MINUTES = 35

function makeDto(overrides: Partial<CreateAppointmentDto> = {}): CreateAppointmentDto {
  const startAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() // +2h
  return {
    professionalId: PRO_ID,
    startAt,
    items:          [{ serviceId: SVC_ID }],
    ...overrides,
  }
}

function makeCreatedAppointment(startAt: Date) {
  const endAt = new Date(startAt.getTime() + TOTAL_MINUTES * 60_000)
  return {
    id:             'appt_001',
    tenantId:       TENANT_ID,
    professionalId: PRO_ID,
    clientId:       CLIENT_ID,
    status:         AppointmentStatus.CONFIRMED,
    startAt,
    endAt,
    totalMinutes:   TOTAL_MINUTES,
    totalPrice:     1500,
    confirmedAt:    new Date(),
    items:          [],
    professional:   { id: PRO_ID, displayName: 'Ana', avatarUrl: null },
    client:         { id: CLIENT_ID, firstName: 'Juan', lastName: 'Pérez', email: 'juan@test.com' },
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

describe('AppointmentsService.create', () => {
  let service: AppointmentsService

  const mockPrisma = {
    professional: { findFirst:  jest.fn() },
    user:         { findUnique: jest.fn() },
    appointment:  { findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(),
  }
  const mockSchedules = {
    resolveServices:      jest.fn(),
    computeTotalDuration: jest.fn(),
  }
  const mockBranches = {
    resolveBranchId:             jest.fn(),
    requireProfessionalInBranch: jest.fn(),
  }

  /**
   * Builds a mock $transaction that calls the callback with a tx object.
   *
   * opts.clientUpsertId     — id returned by tx.client.upsert  (auth user path)
   * opts.clientFindFirst    — value returned by tx.client.findFirst (guest path)
   * opts.clientCreateId     — id returned by tx.client.create   (guest path, new record)
   */
  function setupTransactionMock(
    overlapCount: number,
    createResult: unknown,
    opts: {
      clientUpsertId?:  string
      clientFindFirst?: { id: string } | null
      clientCreateId?:  string
    } = {},
  ) {
    const mockTx = {
      client: {
        upsert:    jest.fn().mockResolvedValue({ id: opts.clientUpsertId  ?? CLIENT_ID }),
        findFirst: jest.fn().mockResolvedValue(opts.clientFindFirst ?? null),
        create:    jest.fn().mockResolvedValue({ id: opts.clientCreateId ?? CLIENT_ID }),
      },
      appointment: {
        count:  jest.fn().mockResolvedValue(overlapCount),
        create: jest.fn().mockResolvedValue(createResult),
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
        { provide: BranchesService,  useValue: mockBranches  },
      ],
    }).compile()

    service = module.get<AppointmentsService>(AppointmentsService)

    jest.clearAllMocks()

    // Default happy-path mocks
    mockPrisma.professional.findFirst.mockResolvedValue(makeProfessional())
    mockPrisma.user.findUnique.mockResolvedValue(makeUser())
    mockSchedules.resolveServices.mockResolvedValue(makeServices())
    mockSchedules.computeTotalDuration.mockReturnValue(TOTAL_MINUTES)
    // BranchesService default: single-branch fallback resolves to the
    // tenant default; pro is linked to that branch.
    mockBranches.resolveBranchId.mockResolvedValue(BRANCH_ID)
    mockBranches.requireProfessionalInBranch.mockResolvedValue(undefined)
  })

  // ── Pre-transaction validation failures ───────────────────────────────────

  describe('validation — professional checks', () => {
    it('throws NotFoundException when professional does not exist', async () => {
      mockPrisma.professional.findFirst.mockResolvedValue(null)

      await expect(service.create(TENANT_ID, USER_ID, makeDto()))
        .rejects.toThrow(NotFoundException)
    })

    it('throws NotFoundException when professional belongs to a different tenant', async () => {
      mockPrisma.professional.findFirst.mockResolvedValue(null)

      await expect(service.create('other_tenant', USER_ID, makeDto()))
        .rejects.toThrow(NotFoundException)
    })

    it('throws BadRequestException when professional does not accept online bookings', async () => {
      mockPrisma.professional.findFirst.mockResolvedValue(
        makeProfessional({ acceptsOnlineBooking: false }),
      )

      await expect(service.create(TENANT_ID, USER_ID, makeDto()))
        .rejects.toThrow(BadRequestException)
    })
  })

  describe('validation — guest booking', () => {
    it('throws ForbiddenException when guest booking is disabled for the tenant', async () => {
      mockPrisma.professional.findFirst.mockResolvedValue(
        makeProfessional({
          tenant: {
            id:            TENANT_ID,
            timezone:      'America/Argentina/Buenos_Aires',
            scheduleRules: makeScheduleRules({ allowGuestBooking: false }),
          },
        }),
      )

      await expect(service.create(TENANT_ID, null, makeDto()))
        .rejects.toThrow(ForbiddenException)
    })

    it('throws BadRequestException when guest is missing name', async () => {
      await expect(
        service.create(TENANT_ID, null, makeDto({ guestEmail: 'a@b.com' })),
      ).rejects.toThrow(BadRequestException)
    })

    it('throws BadRequestException when guest is missing email', async () => {
      await expect(
        service.create(TENANT_ID, null, makeDto({ guestName: 'Ana' })),
      ).rejects.toThrow(BadRequestException)
    })

    it('accepts guest booking when name + email are provided', async () => {
      const dto     = makeDto({ guestName: 'Ana García', guestEmail: 'ana@test.com' })
      const created = makeCreatedAppointment(new Date(dto.startAt))
      const mockTx  = setupTransactionMock(0, created)

      const result = await service.create(TENANT_ID, null, dto)

      expect(result).toEqual(created)
      // Guest path: findFirst runs first (returns null by default), then create
      expect(mockTx.client.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: TENANT_ID, userId: null, email: 'ana@test.com' }),
        }),
      )
      expect(mockTx.client.create).toHaveBeenCalled()
      // user.findUnique must NOT be called for guests
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled()
    })
  })

  describe('validation — timing constraints', () => {
    it('throws BadRequestException when startAt is in the past', async () => {
      const pastStart = new Date(Date.now() - 10 * 60 * 1000).toISOString()

      await expect(service.create(TENANT_ID, USER_ID, makeDto({ startAt: pastStart })))
        .rejects.toThrow(BadRequestException)
    })

    it('throws BadRequestException when startAt is within minAdvanceMinutes', async () => {
      const tooSoon = new Date(Date.now() + 30 * 60 * 1000).toISOString()

      await expect(service.create(TENANT_ID, USER_ID, makeDto({ startAt: tooSoon })))
        .rejects.toThrow(BadRequestException)
    })

    it('throws BadRequestException when startAt exceeds bookingWindowDays', async () => {
      const tooFar = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString()

      await expect(service.create(TENANT_ID, USER_ID, makeDto({ startAt: tooFar })))
        .rejects.toThrow(BadRequestException)
    })
  })

  // ── Client resolution ─────────────────────────────────────────────────────

  describe('client resolution — authenticated user', () => {
    it('loads user details from DB before entering the transaction', async () => {
      const dto    = makeDto()
      const mockTx = setupTransactionMock(0, makeCreatedAppointment(new Date(dto.startAt)))

      await service.create(TENANT_ID, USER_ID, dto)

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where:  { id: USER_ID },
        select: { firstName: true, lastName: true, email: true },
      })
      // upsert must have been called inside the transaction
      expect(mockTx.client.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where:  { tenantId_userId: { tenantId: TENANT_ID, userId: USER_ID } },
          create: expect.objectContaining({ tenantId: TENANT_ID, userId: USER_ID }),
          update: {},
        }),
      )
    })

    it('passes the resolved Client.id (not userId) to appointment.create', async () => {
      const dto    = makeDto()
      const mockTx = setupTransactionMock(0, makeCreatedAppointment(new Date(dto.startAt)), {
        clientUpsertId: CLIENT_ID,
      })

      await service.create(TENANT_ID, USER_ID, dto)

      expect(mockTx.appointment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ clientId: CLIENT_ID }),
        }),
      )
    })

    it('does not overwrite existing client data on re-booking (update: {})', async () => {
      const dto    = makeDto()
      const mockTx = setupTransactionMock(0, makeCreatedAppointment(new Date(dto.startAt)))

      await service.create(TENANT_ID, USER_ID, dto)

      expect(mockTx.client.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ update: {} }),
      )
    })

    it('throws NotFoundException when the user account is not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)

      await expect(service.create(TENANT_ID, USER_ID, makeDto()))
        .rejects.toThrow(NotFoundException)
    })

    it('does not call tx.client.findFirst or tx.client.create for authenticated users', async () => {
      const dto    = makeDto()
      const mockTx = setupTransactionMock(0, makeCreatedAppointment(new Date(dto.startAt)))

      await service.create(TENANT_ID, USER_ID, dto)

      expect(mockTx.client.findFirst).not.toHaveBeenCalled()
      expect(mockTx.client.create).not.toHaveBeenCalled()
    })
  })

  describe('client resolution — guest', () => {
    const guestDto = () =>
      makeDto({ guestName: 'María López', guestEmail: 'maria@test.com', guestPhone: '1122334455' })

    it('creates a new guest Client when no match is found by email', async () => {
      const dto    = guestDto()
      const mockTx = setupTransactionMock(0, makeCreatedAppointment(new Date(dto.startAt)), {
        clientFindFirst: null,   // no existing guest client
        clientCreateId:  CLIENT_ID,
      })

      await service.create(TENANT_ID, null, dto)

      expect(mockTx.client.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: TENANT_ID, userId: null, email: 'maria@test.com' },
        }),
      )
      expect(mockTx.client.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId:  TENANT_ID,
            email:     'maria@test.com',
            phone:     '1122334455',
          }),
        }),
      )
    })

    it('reuses an existing guest Client when email already exists for the tenant', async () => {
      const dto             = guestDto()
      const existingClient  = { id: 'cli_existing' }
      const mockTx          = setupTransactionMock(0, makeCreatedAppointment(new Date(dto.startAt)), {
        clientFindFirst: existingClient,
      })

      await service.create(TENANT_ID, null, dto)

      // Found existing — must not create a new one
      expect(mockTx.client.findFirst).toHaveBeenCalled()
      expect(mockTx.client.create).not.toHaveBeenCalled()

      expect(mockTx.appointment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ clientId: 'cli_existing' }),
        }),
      )
    })

    it('splits single-word guest name into firstName = lastName', async () => {
      const dto    = makeDto({ guestName: 'Madonna', guestEmail: 'madonna@test.com' })
      const mockTx = setupTransactionMock(0, makeCreatedAppointment(new Date(dto.startAt)))

      await service.create(TENANT_ID, null, dto)

      expect(mockTx.client.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ firstName: 'Madonna', lastName: 'Madonna' }),
        }),
      )
    })

    it('splits multi-word guest name correctly', async () => {
      const dto    = makeDto({ guestName: 'Juan Carlos Pérez', guestEmail: 'jcp@test.com' })
      const mockTx = setupTransactionMock(0, makeCreatedAppointment(new Date(dto.startAt)))

      await service.create(TENANT_ID, null, dto)

      expect(mockTx.client.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ firstName: 'Juan', lastName: 'Carlos Pérez' }),
        }),
      )
    })

    it('does not call user.findUnique for guest bookings', async () => {
      const dto = guestDto()
      setupTransactionMock(0, makeCreatedAppointment(new Date(dto.startAt)))

      await service.create(TENANT_ID, null, dto)

      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled()
    })
  })

  // ── Successful bookings ───────────────────────────────────────────────────

  describe('successful bookings', () => {
    it('creates appointment for authenticated user with CONFIRMED status when autoConfirm=true', async () => {
      const dto     = makeDto()
      const created = makeCreatedAppointment(new Date(dto.startAt))
      const mockTx  = setupTransactionMock(0, created)

      const result = await service.create(TENANT_ID, USER_ID, dto)

      expect(result).toEqual(created)
      expect(mockTx.appointment.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
          }),
        }),
      )
      expect(mockTx.appointment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status:      AppointmentStatus.CONFIRMED,
            confirmedAt: expect.any(Date),
            clientId:    CLIENT_ID,
          }),
        }),
      )
    })

    it('creates appointment with PENDING status when autoConfirm=false', async () => {
      mockPrisma.professional.findFirst.mockResolvedValue(
        makeProfessional({
          tenant: {
            id:            TENANT_ID,
            timezone:      'America/Argentina/Buenos_Aires',
            scheduleRules: makeScheduleRules({ autoConfirm: false }),
          },
        }),
      )
      const dto     = makeDto()
      const created = {
        ...makeCreatedAppointment(new Date(dto.startAt)),
        status:      AppointmentStatus.PENDING,
        confirmedAt: null,
      }
      const mockTx = setupTransactionMock(0, created)

      const result = await service.create(TENANT_ID, USER_ID, dto)

      expect(result).toEqual(created)
      expect(mockTx.appointment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status:      AppointmentStatus.PENDING,
            confirmedAt: null,
          }),
        }),
      )
    })

    it('stores service snapshots (name, duration, price) at booking time', async () => {
      const dto    = makeDto()
      const mockTx = setupTransactionMock(0, makeCreatedAppointment(new Date(dto.startAt)))

      await service.create(TENANT_ID, USER_ID, dto)

      expect(mockTx.appointment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            items: {
              create: [
                expect.objectContaining({
                  serviceId:       SVC_ID,
                  serviceName:     'Corte',
                  durationMinutes: 30,
                  price:           1500,
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
      const mockTx  = setupTransactionMock(0, makeCreatedAppointment(startAt))

      await service.create(TENANT_ID, USER_ID, dto)

      const createCall = mockTx.appointment.create.mock.calls[0][0]
      const { startAt: calledStart, endAt } = createCall.data as { startAt: Date; endAt: Date }

      expect(endAt.getTime() - calledStart.getTime()).toBe(TOTAL_MINUTES * 60_000)
    })

    it('passes SERIALIZABLE isolation level to $transaction', async () => {
      const dto = makeDto()
      setupTransactionMock(0, makeCreatedAppointment(new Date(dto.startAt)))

      await service.create(TENANT_ID, USER_ID, dto)

      expect(mockPrisma.$transaction).toHaveBeenCalledWith(
        expect.any(Function),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )
    })

    it('stores guestName/guestEmail/guestPhone as snapshots even for authenticated users', async () => {
      // Snapshots are stored regardless of auth status for audit purposes.
      const dto    = makeDto({ guestName: 'override', guestEmail: 'snap@test.com', guestPhone: '555' })
      const mockTx = setupTransactionMock(0, makeCreatedAppointment(new Date(dto.startAt)))

      await service.create(TENANT_ID, USER_ID, dto)

      expect(mockTx.appointment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            guestName:  'override',
            guestEmail: 'snap@test.com',
            guestPhone: '555',
          }),
        }),
      )
    })
  })

  // ── Conflict detection ────────────────────────────────────────────────────

  describe('conflict detection — overlap', () => {
    it('throws ConflictException when overlap count > 0', async () => {
      setupTransactionMock(1, null)

      await expect(service.create(TENANT_ID, USER_ID, makeDto()))
        .rejects.toThrow(ConflictException)
    })

    it('throws ConflictException with "no longer available" message when slot is taken', async () => {
      setupTransactionMock(1, null)

      await expect(service.create(TENANT_ID, USER_ID, makeDto()))
        .rejects.toThrow('no longer available')
    })

    it('does NOT conflict when existing appointment is CANCELLED', async () => {
      const dto     = makeDto()
      const created = makeCreatedAppointment(new Date(dto.startAt))
      const mockTx  = setupTransactionMock(0, created)

      const result = await service.create(TENANT_ID, USER_ID, dto)

      expect(result).toEqual(created)
      expect(mockTx.appointment.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
          }),
        }),
      )
    })

    it('does NOT conflict when existing appointment is COMPLETED', async () => {
      const dto     = makeDto()
      const created = makeCreatedAppointment(new Date(dto.startAt))
      setupTransactionMock(0, created)

      await expect(service.create(TENANT_ID, USER_ID, dto)).resolves.toEqual(created)
    })

    it('uses half-open interval [startAt, endAt) for overlap check', async () => {
      const dto     = makeDto()
      const startAt = new Date(dto.startAt)
      const endAt   = new Date(startAt.getTime() + TOTAL_MINUTES * 60_000)
      const mockTx  = setupTransactionMock(0, makeCreatedAppointment(startAt))

      await service.create(TENANT_ID, USER_ID, dto)

      expect(mockTx.appointment.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            startAt: { lt: endAt },
            endAt:   { gt: startAt },
          }),
        }),
      )
    })
  })

  describe('conflict detection — DB constraint violations', () => {
    it('translates P2002 (unique violation) to HTTP 409 ConflictException', async () => {
      mockPrisma.$transaction.mockRejectedValue(makePrismaError('P2002'))

      await expect(service.create(TENANT_ID, USER_ID, makeDto()))
        .rejects.toThrow(ConflictException)
    })

    it('translates P2034 (serialization failure) to HTTP 409 ConflictException', async () => {
      mockPrisma.$transaction.mockRejectedValue(makePrismaError('P2034'))

      await expect(service.create(TENANT_ID, USER_ID, makeDto()))
        .rejects.toThrow(ConflictException)
    })

    it('P2034 message suggests retrying', async () => {
      mockPrisma.$transaction.mockRejectedValue(makePrismaError('P2034'))

      await expect(service.create(TENANT_ID, USER_ID, makeDto()))
        .rejects.toThrow('try again')
    })

    it('re-throws unexpected DB errors without wrapping', async () => {
      mockPrisma.$transaction.mockRejectedValue(new Error('unexpected DB error'))

      await expect(service.create(TENANT_ID, USER_ID, makeDto()))
        .rejects.toThrow('unexpected DB error')
    })

    it('re-throws unknown Prisma error codes without wrapping', async () => {
      mockPrisma.$transaction.mockRejectedValue(makePrismaError('P9999'))

      await expect(service.create(TENANT_ID, USER_ID, makeDto()))
        .rejects.toThrow(Prisma.PrismaClientKnownRequestError)
    })
  })

  // ── Concurrent booking simulation ─────────────────────────────────────────

  describe('concurrent booking simulation', () => {
    it('only one booking succeeds when two requests race for the same slot', async () => {
      const dto     = makeDto()
      const created = makeCreatedAppointment(new Date(dto.startAt))

      mockPrisma.$transaction
        .mockImplementationOnce(async (callback: (tx: unknown) => Promise<unknown>) =>
          callback({
            client: {
              upsert:    jest.fn().mockResolvedValue({ id: CLIENT_ID }),
              findFirst: jest.fn().mockResolvedValue(null),
              create:    jest.fn().mockResolvedValue({ id: CLIENT_ID }),
            },
            appointment: {
              count:  jest.fn().mockResolvedValue(0),
              create: jest.fn().mockResolvedValue(created),
            },
          }),
        )
        .mockRejectedValueOnce(makePrismaError('P2002'))

      const [result1, result2] = await Promise.allSettled([
        service.create(TENANT_ID, USER_ID, dto),
        service.create(TENANT_ID, USER_ID, dto),
      ])

      expect(result1.status).toBe('fulfilled')
      expect((result1 as PromiseFulfilledResult<unknown>).value).toEqual(created)
      expect(result2.status).toBe('rejected')
      expect((result2 as PromiseRejectedResult).reason).toBeInstanceOf(ConflictException)
    })

  })

  // ── Branch (sucursal) handling ────────────────────────────────────────────

  describe('branch handling', () => {
    const dtoWithBranch = (branchId?: string) => makeDto({ branchId })

    it('resolves branch via BranchesService and persists branchId on insert', async () => {
      const dto    = dtoWithBranch(BRANCH_ID)
      const mockTx = setupTransactionMock(0, makeCreatedAppointment(new Date(dto.startAt)))

      await service.create(TENANT_ID, USER_ID, dto)

      expect(mockBranches.resolveBranchId).toHaveBeenCalledWith(TENANT_ID, BRANCH_ID)
      expect(mockTx.appointment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ branchId: BRANCH_ID }),
        }),
      )
    })

    it('falls back to single active branch when dto.branchId is omitted', async () => {
      // The default mock already returns BRANCH_ID for an undefined input —
      // this mirrors the single-branch tenant scenario.
      const dto = dtoWithBranch(undefined)
      setupTransactionMock(0, makeCreatedAppointment(new Date(dto.startAt)))

      await service.create(TENANT_ID, USER_ID, dto)

      expect(mockBranches.resolveBranchId).toHaveBeenCalledWith(TENANT_ID, undefined)
    })

    it('rejects when BranchesService.resolveBranchId throws (multi-branch + no branchId)', async () => {
      mockBranches.resolveBranchId.mockRejectedValue(
        new BadRequestException('Debés especificar la sucursal (branchId)'),
      )

      await expect(service.create(TENANT_ID, USER_ID, dtoWithBranch(undefined)))
        .rejects.toThrow(BadRequestException)
    })

    it('rejects with NotFoundException when branchId belongs to another tenant', async () => {
      mockBranches.resolveBranchId.mockRejectedValue(
        new NotFoundException('Sucursal no encontrada o inactiva'),
      )

      await expect(service.create(TENANT_ID, USER_ID, dtoWithBranch('br_alien')))
        .rejects.toThrow(NotFoundException)
    })

    it('rejects when professional does not atender en esa sucursal', async () => {
      mockBranches.requireProfessionalInBranch.mockRejectedValue(
        new BadRequestException('El profesional no atiende en esta sucursal'),
      )

      await expect(service.create(TENANT_ID, USER_ID, dtoWithBranch(OTHER_BRANCH_ID)))
        .rejects.toThrow(BadRequestException)
    })

    it('overlap query stays branch-agnostic (cross-branch double-booking guard)', async () => {
      // CRITICAL: even though we resolved a specific branchId, the overlap
      // count must NOT filter by branchId — the same physical pro cannot
      // be in two sucursales at once.
      const dto    = dtoWithBranch(BRANCH_ID)
      const mockTx = setupTransactionMock(0, makeCreatedAppointment(new Date(dto.startAt)))

      await service.create(TENANT_ID, USER_ID, dto)

      const countCall = mockTx.appointment.count.mock.calls[0][0]
      expect(countCall.where).not.toHaveProperty('branchId')
      expect(countCall.where).toEqual(
        expect.objectContaining({
          professionalId: PRO_ID,
          tenantId:       TENANT_ID,
        }),
      )
    })

    it('returns ConflictException when the same pro is already booked at another branch (overlap > 0)', async () => {
      // Simulates: pro_001 has an existing appointment at OTHER_BRANCH_ID
      // overlapping the requested time. Even though the new booking is at
      // BRANCH_ID, the count finds it because the query is branch-agnostic.
      setupTransactionMock(1, null)

      await expect(service.create(TENANT_ID, USER_ID, dtoWithBranch(BRANCH_ID)))
        .rejects.toThrow(ConflictException)
    })
  })

  // ── Concurrent booking simulation (continued) ─────────────────────────────

  describe('concurrent booking simulation (extended)', () => {
    it('only one booking succeeds when two overlapping slots race (SERIALIZABLE conflict)', async () => {
      const dto1 = makeDto()
      const dto2 = makeDto({
        startAt: new Date(new Date(dto1.startAt).getTime() + 10 * 60_000).toISOString(),
      }) // 10 min later — still overlaps given totalMinutes=35

      const created = makeCreatedAppointment(new Date(dto1.startAt))

      mockPrisma.$transaction
        .mockImplementationOnce(async (callback: (tx: unknown) => Promise<unknown>) =>
          callback({
            client: {
              upsert:    jest.fn().mockResolvedValue({ id: CLIENT_ID }),
              findFirst: jest.fn().mockResolvedValue(null),
              create:    jest.fn().mockResolvedValue({ id: CLIENT_ID }),
            },
            appointment: {
              count:  jest.fn().mockResolvedValue(0),
              create: jest.fn().mockResolvedValue(created),
            },
          }),
        )
        .mockRejectedValueOnce(makePrismaError('P2034'))

      const [result1, result2] = await Promise.allSettled([
        service.create(TENANT_ID, USER_ID, dto1),
        service.create(TENANT_ID, USER_ID, dto2),
      ])

      expect(result1.status).toBe('fulfilled')
      expect(result2.status).toBe('rejected')
      expect((result2 as PromiseRejectedResult).reason).toBeInstanceOf(ConflictException)
    })
  })
})
