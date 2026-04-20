import {
  IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString,
  Max, Min, MaxLength, ValidateNested, IsArray, ArrayMaxSize, ArrayMinSize,
} from 'class-validator'
import { Type } from 'class-transformer'
import { LoyaltyRewardType, LoyaltyRewardMode } from '@prisma/client'

export class RewardItemDto {
  @IsInt()
  @Min(1)
  @Max(4)
  position!: number

  @IsInt()
  @Min(1)
  @Max(50)
  stampsRequired!: number

  @IsEnum(LoyaltyRewardType)
  rewardType!: LoyaltyRewardType

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  rewardValue?: number

  @IsString()
  @MaxLength(120)
  rewardLabel!: string
}

export class UpdateProgramDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean

  @IsOptional()
  @IsBoolean()
  showOnBooking?: boolean

  @IsOptional()
  @IsEnum(LoyaltyRewardMode)
  rewardMode?: LoyaltyRewardMode

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => RewardItemDto)
  rewards?: RewardItemDto[]

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
  @MaxLength(9)
  cardColor?: string

  @IsOptional()
  @IsString()
  @MaxLength(9)
  cardAccentColor?: string

  @IsOptional()
  @IsString()
  cardBgImageUrl?: string
}
