import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma, LoyaltyRewardType, LoyaltyRewardMode, LoyaltyStampReason } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { UpdateProgramDto } from './dto/update-program.dto'

const DEFAULT_PROGRAM = {
  isActive:        false,
  rewardMode:      LoyaltyRewardMode.CUMULATIVE,
  stampsRequired:  5,
  rewardType:      LoyaltyRewardType.FREE_SERVICE,
  rewardValue:     null,
  rewardLabel:     'Servicio gratis',
  cardTitle:       'Club de Fidelidad',
  cardSubtitle:    'Sumá sellos para obtener beneficios',
  cardColor:       '#0f172a',
  cardAccentColor: '#3b82f6',
}

const REWARDS_INCLUDE = {
  rewards: { orderBy: { position: 'asc' as const } },
}

@Injectable()
export class LoyaltyService {
  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────────────────────────────────────────────────────────────
  // Program (config del tenant)
  // ───────────────────────────────────────────────────────────────────────────

  async getProgram(tenantId: string) {
    const existing = await this.prisma.loyaltyProgram.findUnique({
      where: { tenantId },
      include: REWARDS_INCLUDE,
    })
    if (existing) return existing

    const program = await this.prisma.loyaltyProgram.create({
      data: { tenantId, ...DEFAULT_PROGRAM },
    })
    // Crear reward default
    const reward = await this.prisma.loyaltyReward.create({
      data: {
        programId:      program.id,
        position:       1,
        stampsRequired: 5,
        rewardType:     LoyaltyRewardType.FREE_SERVICE,
        rewardLabel:    'Servicio gratis',
      },
    })
    return { ...program, rewards: [reward] }
  }

  async updateProgram(tenantId: string, dto: UpdateProgramDto) {
    const { rewards: rewardsInput, eligibleServiceIds, ...rest } = dto

    await this.getProgram(tenantId) // garantiza que exista

    const data: Prisma.LoyaltyProgramUpdateInput = { ...rest }
    if (eligibleServiceIds !== undefined) {
      data.eligibleServiceIds = eligibleServiceIds === null
        ? Prisma.DbNull
        : (eligibleServiceIds as Prisma.InputJsonValue)
    }

    // Sync legacy fields con el primer reward (backward compat)
    if (rewardsInput && rewardsInput.length > 0) {
      const first = rewardsInput.find(r => r.position === 1) ?? rewardsInput[0]
      data.stampsRequired = first.stampsRequired
      data.rewardType = first.rewardType
      data.rewardValue = first.rewardType === LoyaltyRewardType.FREE_SERVICE ? null : first.rewardValue ?? null
      data.rewardLabel = first.rewardLabel
    }

    return this.prisma.$transaction(async (tx) => {
      const program = await tx.loyaltyProgram.update({ where: { tenantId }, data })

      if (rewardsInput) {
        // Delete + recreate (max 4 rows, simple y seguro)
        await tx.loyaltyReward.deleteMany({ where: { programId: program.id } })
        for (const r of rewardsInput) {
          await tx.loyaltyReward.create({
            data: {
              programId:      program.id,
              position:       r.position,
              stampsRequired: r.stampsRequired,
              rewardType:     r.rewardType,
              rewardValue:    r.rewardType === LoyaltyRewardType.FREE_SERVICE ? null : r.rewardValue ?? null,
              rewardLabel:    r.rewardLabel,
            },
          })
        }
      }

      return tx.loyaltyProgram.findUnique({
        where: { tenantId },
        include: REWARDS_INCLUDE,
      })
    })
  }

  async getPublicProgram(tenantId: string) {
    const program = await this.prisma.loyaltyProgram.findUnique({
      where: { tenantId },
      include: REWARDS_INCLUDE,
    })
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
      rewardMode:      program.rewardMode,
      rewards:         program.rewards.map(r => ({
        id: r.id, position: r.position, stampsRequired: r.stampsRequired,
        rewardType: r.rewardType, rewardValue: r.rewardValue, rewardLabel: r.rewardLabel,
      })),
    }
  }

  async getBookingCard(tenantId: string, email: string) {
    const program = await this.prisma.loyaltyProgram.findUnique({
      where: { tenantId },
      include: REWARDS_INCLUDE,
    })
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
      availableRewardIds: card.availableRewardIds as string[],
      clientName:       `${client.firstName} ${client.lastName}`.trim(),
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Cards
  // ───────────────────────────────────────────────────────────────────────────

  async listCards(tenantId: string) {
    return this.prisma.loyaltyCard.findMany({
      where:   { tenantId },
      orderBy: { updatedAt: 'desc' },
      include: {
        client: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      },
    })
  }

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

  async getCardPublic(cardId: string) {
    const card = await this.prisma.loyaltyCard.findUnique({
      where:   { id: cardId },
      include: {
        program: { include: REWARDS_INCLUDE },
        client:  { select: { firstName: true, lastName: true } },
        tenant:  { select: { name: true, slug: true, logoUrl: true } },
      },
    })
    if (!card) throw new NotFoundException('Tarjeta no encontrada')
    return card
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Stamps
  // ───────────────────────────────────────────────────────────────────────────

  async issueStampForAppointment(
    tx: Prisma.TransactionClient,
    params: { tenantId: string; appointmentId: string; clientId: string; serviceIds: string[] },
  ) {
    const { tenantId, appointmentId, clientId, serviceIds } = params

    const program = await tx.loyaltyProgram.findUnique({
      where: { tenantId },
      include: REWARDS_INCLUDE,
    })
    if (!program || !program.isActive) return null
    if (program.rewards.length === 0) return null

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

    try {
      await tx.loyaltyStamp.create({
        data: { cardId: card.id, appointmentId, delta: 1, reason: LoyaltyStampReason.COMPLETED },
      })
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return card
      throw e
    }

    const rewards = program.rewards // already sorted by position
    const cycleMax = Math.max(...rewards.map(r => r.stampsRequired))
    const oldCount = card.stampsCount
    const newCount = oldCount + 1

    // Detect newly unlocked rewards
    const currentAvailable = (card.availableRewardIds as string[]) || []
    const newlyUnlocked: string[] = []
    for (const reward of rewards) {
      if (oldCount < reward.stampsRequired && newCount >= reward.stampsRequired) {
        newlyUnlocked.push(reward.id)
      }
    }

    let stampsCount = newCount
    if (newCount >= cycleMax) {
      stampsCount = 0
    }

    const availableRewardIds = [...currentAvailable, ...newlyUnlocked]

    return tx.loyaltyCard.update({
      where: { id: card.id },
      data: {
        stampsCount,
        totalStampsEarned:  card.totalStampsEarned + 1,
        rewardsAvailable:   availableRewardIds.length,
        availableRewardIds: availableRewardIds as any,
        lastStampAt:        new Date(),
      },
    })
  }

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
          cardId: card.id, appointmentId, reason: LoyaltyStampReason.COMPLETED,
        },
      },
    })
    if (!original) return null

    try {
      await tx.loyaltyStamp.create({
        data: { cardId: card.id, appointmentId, delta: -1, reason: LoyaltyStampReason.REVERSAL },
      })
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return card
      throw e
    }

    const stampsCount       = Math.max(0, card.stampsCount - 1)
    const totalStampsEarned = Math.max(0, card.totalStampsEarned - 1)

    return tx.loyaltyCard.update({
      where: { id: card.id },
      data:  { stampsCount, totalStampsEarned },
    })
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Redemptions
  // ───────────────────────────────────────────────────────────────────────────

  async redeemReward(
    tenantId: string,
    cardId: string,
    params: { rewardId: string; appointmentId?: string; staffUserId?: string },
  ) {
    const card = await this.prisma.loyaltyCard.findFirst({
      where: { id: cardId, tenantId },
    })
    if (!card) throw new NotFoundException('Tarjeta no encontrada')

    const available = (card.availableRewardIds as string[]) || []
    if (!available.includes(params.rewardId)) {
      throw new BadRequestException('Este reward no está disponible para canjear')
    }

    const reward = await this.prisma.loyaltyReward.findUnique({ where: { id: params.rewardId } })
    if (!reward) throw new NotFoundException('Reward no encontrado')

    return this.prisma.$transaction(async (tx) => {
      const redemption = await tx.loyaltyRedemption.create({
        data: {
          cardId:           card.id,
          appointmentId:    params.appointmentId,
          rewardType:       reward.rewardType,
          rewardValue:      reward.rewardValue,
          rewardLabel:      reward.rewardLabel,
          redeemedByUserId: params.staffUserId,
        },
      })

      // Remove first occurrence of this rewardId from available list
      const updatedAvailable = [...available]
      const idx = updatedAvailable.indexOf(params.rewardId)
      if (idx !== -1) updatedAvailable.splice(idx, 1)

      const updated = await tx.loyaltyCard.update({
        where: { id: card.id },
        data: {
          rewardsAvailable:   updatedAvailable.length,
          availableRewardIds: updatedAvailable as any,
          rewardsRedeemed:    card.rewardsRedeemed + 1,
        },
      })
      return { redemption, card: updated }
    })
  }
}
