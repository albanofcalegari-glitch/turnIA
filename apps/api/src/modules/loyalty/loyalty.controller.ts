import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { SkipMembershipCheck } from '../../common/decorators/skip-membership-check.decorator'
import { JwtPayload, TenantRole } from '@turnia/shared'
import { LoyaltyService } from './loyalty.service'
import { UpdateProgramDto } from './dto/update-program.dto'
import { RedeemDto } from './dto/redeem.dto'

@Controller('loyalty')
export class LoyaltyController {
  constructor(private readonly loyalty: LoyaltyService) {}

  // ── Program config (admin) ────────────────────────────────────────────────

  @Get('program')
  @UseGuards(JwtAuthGuard)
  getProgram(@CurrentUser() user: JwtPayload) {
    if (!user.tenantId) throw new ForbiddenException()
    return this.loyalty.getProgram(user.tenantId)
  }

  @Put('program')
  @UseGuards(JwtAuthGuard)
  updateProgram(@CurrentUser() user: JwtPayload, @Body() dto: UpdateProgramDto) {
    if (!user.tenantId) throw new ForbiddenException()
    if (user.role !== TenantRole.ADMIN) {
      throw new ForbiddenException('Solo el administrador puede editar el programa de fidelidad')
    }
    return this.loyalty.updateProgram(user.tenantId, dto)
  }

  // ── Cards list (staff del negocio) ────────────────────────────────────────

  @Get('cards')
  @UseGuards(JwtAuthGuard)
  listCards(@CurrentUser() user: JwtPayload) {
    if (!user.tenantId) throw new ForbiddenException()
    if (user.role !== TenantRole.ADMIN && user.role !== TenantRole.PROFESSIONAL) {
      throw new ForbiddenException()
    }
    return this.loyalty.listCards(user.tenantId)
  }

  // ── Canje del reward (staff) ──────────────────────────────────────────────

  @Post('cards/:cardId/redeem')
  @UseGuards(JwtAuthGuard)
  redeem(
    @CurrentUser() user: JwtPayload,
    @Param('cardId') cardId: string,
    @Body() dto: RedeemDto,
  ) {
    if (!user.tenantId) throw new ForbiddenException()
    if (user.role !== TenantRole.ADMIN && user.role !== TenantRole.PROFESSIONAL) {
      throw new ForbiddenException()
    }
    return this.loyalty.redeemReward(user.tenantId, cardId, {
      rewardId:      dto.rewardId,
      appointmentId: dto.appointmentId,
      staffUserId:   user.sub,
    })
  }

  // ── Vista del cliente (su propia tarjeta) ─────────────────────────────────

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @SkipMembershipCheck() // el cliente debe poder ver su tarjeta aunque el tenant esté vencido
  getMyCard(@CurrentUser() user: JwtPayload) {
    if (!user.tenantId) throw new ForbiddenException()
    return this.loyalty.getCardForClient(user.tenantId, user.sub)
  }

  // ── Vista pública (QR) ────────────────────────────────────────────────────

  @Get('public/:cardId')
  @SkipMembershipCheck()
  getPublicCard(@Param('cardId') cardId: string) {
    return this.loyalty.getCardPublic(cardId)
  }

  // ── Programa público (para booking page) ──────────────────────────────────

  @Get('booking-program/:tenantId')
  @SkipMembershipCheck()
  getPublicProgram(@Param('tenantId') tenantId: string) {
    return this.loyalty.getPublicProgram(tenantId)
  }

  @Get('booking-card/:tenantId')
  @SkipMembershipCheck()
  getBookingCard(
    @Param('tenantId') tenantId: string,
    @Query('email') email: string,
  ) {
    return this.loyalty.getBookingCard(tenantId, email)
  }
}
