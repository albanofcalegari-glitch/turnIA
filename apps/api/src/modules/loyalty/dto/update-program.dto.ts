import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, Min, MaxLength } from 'class-validator'
import { LoyaltyRewardType } from '@prisma/client'

export class UpdateProgramDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean

  @IsOptional()
  @IsBoolean()
  showOnBooking?: boolean

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  stampsRequired?: number

  @IsOptional()
  @IsEnum(LoyaltyRewardType)
  rewardType?: LoyaltyRewardType

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  rewardValue?: number

  @IsOptional()
  @IsString()
  @MaxLength(120)
  rewardLabel?: string

  @IsOptional()
  eligibleServiceIds?: string[] | null

  @IsOptional()
  @IsString()
  @MaxLength(60)
  cardTitle?: string

  @IsOptional()
  @IsString()
  @MaxLength(120)
  cardSubtitle?: string

  @IsOptional()
  @IsString()
  @MaxLength(9) // #RRGGBB or #RRGGBBAA
  cardColor?: string

  @IsOptional()
  @IsString()
  @MaxLength(9)
  cardAccentColor?: string

  @IsOptional()
  @IsString()
  cardBgImageUrl?: string
}
