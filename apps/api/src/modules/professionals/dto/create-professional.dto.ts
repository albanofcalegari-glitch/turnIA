import { IsString, IsOptional, IsBoolean } from 'class-validator'

export class CreateProfessionalDto {
  /**
   * Name displayed on the booking page (e.g. "Ana García", "Barbero Martín").
   * Decoupled from the User's firstName/lastName so the business can configure
   * how the professional appears publicly.
   */
  @IsString()
  displayName!: string

  /**
   * Hex color used in the agenda calendar (e.g. "#E91E63").
   * Optional — the frontend can assign a default when absent.
   */
  @IsOptional()
  @IsString()
  color?: string

  /**
   * Whether this professional can receive online bookings.
   * Defaults to true. Set to false for staff-only (internal) resources.
   */
  @IsOptional()
  @IsBoolean()
  acceptsOnlineBooking?: boolean

  /**
   * The User account to link this professional to.
   * Optional — when omitted, the endpoint uses the caller's own userId.
   * Useful for single-person businesses where the admin IS the professional,
   * or for admins creating a professional on behalf of another user.
   */
  @IsOptional()
  @IsString()
  userId?: string
}
