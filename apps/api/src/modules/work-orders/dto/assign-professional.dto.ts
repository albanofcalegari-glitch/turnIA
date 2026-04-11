import { IsString } from 'class-validator'

export class AssignProfessionalDto {
  @IsString()
  professionalId!: string
}
