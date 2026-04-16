import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma, LoyaltyRewardType, LoyaltyStampReason, AppointmentStatus } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { UpdateProgramDto } from './dto/update-program.dto'

// Default program seeded the first time an admin opens the UI.
// Matches the most common case we've seen in Argentine barberías: "cada 5, uno gratis".
const DEFAULT_PROGRAM = {
  isActive:        false,
  stampsRequired:  5,
  rewardType:      LoyaltyRewardType.FREE_SERVICE,
  rewardValue:     null,
  rewardLabel:     'Servicio gratis',
  cardTitle:       'Club de Fidelidad',
  cardSubtitle:    'Cada 5 turnos, uno gratis',
  cardColor:       '#0f172a',
  cardAccentColor: '#3b82f6',
}

@Injectable()
export class LoyaltyService {
  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────────────────────────────────────────────────────────────
  // Program (config del tenant)
  // ───────────────────────────────────────────────────────────────────────────

  /** Devuelve la config actual del tenant; crea una default si todavía no existe. */
  async getProgram(tenantId: string) {
    const existing = await this.prisma.loyaltyProgram.findUnique({ where: { tenantId } })
    if (existing) return existing
    return this.prisma.loyaltyProgram.create({ data: { tenantId, ...DEFAULT_PROGRAM } })
  }

  async updateProgram(tenantId: string, dto: UpdateProgramDto) {
    // rewardValue sólo tiene sentido para DISCOUNT_*; para FREE_SERVICE lo anulamos
    // para evitar datos inconsistentes si el admin cambia el tipo y olvida limpiar.
    const { eligibleServiceIds, ...rest } = dto
    const data: Prisma.LoyaltyProgramUpdateInput = { ...rest }
    if (dto.rewardType === LoyaltyRewardType.FREE_SERVICE) {
      data.rewardValue = null
    }
    if (eligibleServiceIds !== undefined) {
      // null explícito = todos los servicios elegibles (limpia el filtro)
      data.eligibleServiceIds = eligibleServiceIds === null
        ? Prisma.DbNull
        : (eligibleServiceIds as Prisma.InputJsonValue)
    }
    await this.getProgram(tenantId) // garantiza que exista
    return this.prisma.loyaltyProgram.update({ where: { tenantId }, data })
  }

  async getPublicProgram(tenantId: string) {
    const program = await this.prisma.loyaltyProgram.findUnique({ where: { tenantId } })
    if (!program || !program.isActive || !program.showOnBooking) return null
    return {
      cardTitle:       program.cardTitle,
      cardSubtitle:    program.cardSubtitle,
      cardColor:       program.cardColor,
      cardAccentColor: program.cardAccentColor,
      cardBgImageUrl:  program.cardBgImageUrl,
      stampsRequired:  program.stampsRequired,
      rewardType:      program.rewardType,
      rewardLabel:     program.rewardLabel,
    }
  }

  async getBookingCard(tenantId: string, email: string) {
    const program = await this.prisma.loyaltyProgram.findUnique({ where: { tenantId } })
    if (!program || !program.isActive || !program.showOnBooking) return null

    const client = await this.prisma.client.findFirst({
      where: { tenantId, email: { equals: email, mode: 'insensitive' } },
    })
    if (!client) return null

    const card = await this.prisma.loyaltyCard.findUnique({ where: { clientId: client.id } })
    if (!card) return null

    return {
      stampsCount:      card.stampsCount,
      rewardsAvailable: card.rewardsAvailable,
      clientName:       `${client.firstName} ${client.lastName}`.trim(),
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Cards (vista del negocio y del cliente)
  // ───────────────────────────────────────────────────────────────────────────

  /** Lista todas las tarjetas del tenant (para la vista del negocio). */
  async listCards(tenantId: string) {
    return this.prisma.loyaltyCard.findMany({
      where:   { tenantId },
      orderBy: { updatedAt: 'desc' },
      include: {
        client: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      },
    })
  }

  /**
   * Devuelve la tarjeta del cliente logueado en el tenant.
   * Si el programa está activo y el cliente no tiene tarjeta todavía, se crea
   * con stamps=0 para que la UI pueda renderizarla desde el primer turno.
   */
  async getCardForClient(tenantId: string, userId: string) {
    const client = await this.prisma.client.findFirst({ where: { tenantId, userId } })
    if (!client) throw new NotFoundException('No tenés turnos registrados en este negocio')

    const program = await this.getProgram(tenantId)
    if (!program.isActive) throw new NotFoundException('El negocio no tiene un programa de fidelidad activo')

    const card = await this.prisma.loyaltyCard.upsert({
      where:  { clientId: client.id },
      update: {},
      create: { tenantId, programId: program.id, clientId: client.id },
    })

    return { program, card, client }
  }

  /** Vista pública de una tarjeta por id (para el QR). No requiere auth. */
  async getCardPublic(cardId: string) {
    const card = await this.prisma.loyaltyCard.findUnique({
      where:   { id: cardId },
      include: {
        program: true,
        client:  { select: { firstName: true, lastName: true } },
        tenant:  { select: { name: true, slug: true, logoUrl: true } },
      },
    })
    if (!card) throw new NotFoundException('Tarjeta no encontrada')
    return card
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Stamps (hook desde appointments)
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Emite un stamp para un appointment recién completado.
   *
   * Idempotente: el unique (cardId, appointmentId, reason=COMPLETED) garantiza
   * que marcar dos veces el mismo turno como COMPLETED no duplica stamps.
   * Si el stampsCount alcanza stampsRequired, incrementa rewardsAvailable y
   * resta el umbral (el resto queda acumulado para el próximo ciclo).
   *
   * Llamado desde AppointmentsService.complete() — no lo uses directo desde
   * un controller sin saber lo que hacés.
   */
  async issueStampForAppointment(
    tx: Prisma.TransactionClient,
    params: { tenantId: string; appointmentId: string; clientId: string; serviceIds: string[] },
  ) {
    const { tenantId, appointmentId, clientId, serviceIds } = params

    const program = await tx.loyaltyProgram.findUnique({ where: { tenantId } })
    if (!program || !program.isActive) return null

    // Filtro por servicios elegibles: si el programa restringe servicios y ninguno
    // del appointment califica, no se emite stamp.
    const eligible = program.eligibleServiceIds as string[] | null | undefined
    if (Array.isArray(eligible) && eligible.length > 0) {
      const matches = serviceIds.some(sid => eligible.includes(sid))
      if (!matches) return null
    }

    const card = await tx.loyaltyCard.upsert({
      where:  { clientId },
      update: {},
      create: { tenantId, programId: program.id, clientId },
    })

    // Intentar crear el stamp; si ya existe (unique violation), salir sin error.
    try {
      await tx.loyaltyStamp.create({
        data: {
          cardId:        card.id,
          appointmentId,
          delta:         1,
          reason:        LoyaltyStampReason.COMPLETED,
        },
      })
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return card
      throw e
    }

    const newStampsCount = card.stampsCount + 1
    let stampsCount      = newStampsCount
    let rewardsAvailable = card.rewardsAvailable
    if (newStampsCount >= program.stampsRequired) {
      // Si alcanzaron el umbral, desbloqueamos un reward y arrancamos otro ciclo.
      // Usamos módulo por si stampsRequired fuese 1 (edge case) o si por alguna
      // razón newStampsCount saltó más de uno — así no perdemos stamps.
      const earned = Math.floor(newStampsCount / program.stampsRequired)
      stampsCount      = newStampsCount % program.stampsRequired
      rewardsAvailable = card.rewardsAvailable + earned
    }

    return tx.loyaltyCard.update({
      where: { id: card.id },
      data:  {
        stampsCount,
        totalStampsEarned: card.totalStampsEarned + 1,
        rewardsAvailable,
        lastStampAt:       new Date(),
      },
    })
  }

  /**
   * Revierte un stamp previamente emitido para un appointment — usado cuando
   * un turno completado se cancela. Idempotente por el mismo unique key.
   */
  async reverseStampForAppointment(
    tx: Prisma.TransactionClient,
    params: { tenantId: string; appointmentId: string; clientId: string },
  ) {
    const { appointmentId, clientId } = params

    const card = await tx.loyaltyCard.findUnique({ where: { clientId } })
    if (!card) return null

    const original = await tx.loyaltyStamp.findUnique({
      where: {
        cardId_appointmentId_reason: {
          cardId:        card.id,
          appointmentId,
          reason:        LoyaltyStampReason.COMPLETED,
        },
      },
    })
    if (!original) return null

    // Registrar reversal — puede fallar si ya se revirtió previamente.
    try {
      await tx.loyaltyStamp.create({
        data: {
          cardId:        card.id,
          appointmentId,
          delta:         -1,
          reason:        LoyaltyStampReason.REVERSAL,
        },
      })
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return card
      throw e
    }

    // Si el stamp original ya "pagó" un reward (es decir, stampsCount ya wrappeó),
    // no podemos quitar ese reward si ya fue canjeado. Sólo ajustamos el contador.
    // Simplificación: sólo restamos el stamp del ciclo actual. Si el cliente ya
    // tiene un reward no canjeado y el stampsCount cae por debajo de 0, lo
    // dejamos en 0 — el ciclo cerró.
    const stampsCount      = Math.max(0, card.stampsCount - 1)
    const totalStampsEarned = Math.max(0, card.totalStampsEarned - 1)

    return tx.loyaltyCard.update({
      where: { id: card.id },
      data:  { stampsCount, totalStampsEarned },
    })
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Redemptions (canje del reward)
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Registra el canje de un reward. Lo dispara el staff cuando el cliente
   * usa su beneficio. Decrementa rewardsAvailable y guarda snapshot del reward
   * al momento del canje (por si la config del programa cambia después).
   */
  async redeemReward(
    tenantId: string,
    cardId: string,
    params: { appointmentId?: string; staffUserId?: string },
  ) {
    const card = await this.prisma.loyaltyCard.findFirst({
      where:   { id: cardId, tenantId },
      include: { program: true },
    })
    if (!card) throw new NotFoundException('Tarjeta no encontrada')
    if (card.rewardsAvailable <= 0) {
      throw new BadRequestException('Esta tarjeta no tiene rewards disponibles para canjear')
    }

    return this.prisma.$transaction(async (tx) => {
      const redemption = await tx.loyaltyRedemption.create({
        data: {
          cardId:           card.id,
          appointmentId:    params.appointmentId,
          rewardType:       card.program.rewardType,
          rewardValue:      card.program.rewardValue,
          rewardLabel:      card.program.rewardLabel,
          redeemedByUserId: params.staffUserId,
        },
      })
      const updated = await tx.loyaltyCard.update({
        where: { id: card.id },
        data:  {
          rewardsAvailable: card.rewardsAvailable - 1,
          rewardsRedeemed:  card.rewardsRedeemed + 1,
        },
      })
      return { redemption, card: updated }
    })
  }
}
