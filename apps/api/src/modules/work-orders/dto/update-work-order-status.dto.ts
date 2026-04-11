import { IsEnum } from 'class-validator'
import { WorkOrderStatus } from '@prisma/client'

/**
 * Allowed status transitions (Phase 1):
 *   PENDING    → CONFIRMED  (all slots must have minProfessionals assigned)
 *   CONFIRMED  → IN_PROGRESS
 *   IN_PROGRESS → COMPLETED
 *   PENDING | CONFIRMED | IN_PROGRESS → CANCELLED
 */
export class UpdateWorkOrderStatusDto {
  @IsEnum(WorkOrderStatus)
  status!: WorkOrderStatus
}
