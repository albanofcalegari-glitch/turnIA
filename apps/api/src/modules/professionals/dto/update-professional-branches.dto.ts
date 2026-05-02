import { ArrayNotEmpty, IsArray, IsString } from 'class-validator'

export class UpdateProfessionalBranchesDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  branchIds!: string[]
}
