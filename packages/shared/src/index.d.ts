export declare enum TenantRole {
    ADMIN = "ADMIN",
    PROFESSIONAL = "PROFESSIONAL",
    CLIENT = "CLIENT"
}
export declare enum AppointmentStatus {
    PENDING = "PENDING",
    CONFIRMED = "CONFIRMED",
    CANCELLED = "CANCELLED",
    COMPLETED = "COMPLETED",
    NO_SHOW = "NO_SHOW",
    RESCHEDULED = "RESCHEDULED"
}
export declare enum ExceptionType {
    BLOCK = "BLOCK",
    VACATION = "VACATION",
    HOLIDAY = "HOLIDAY",
    CUSTOM_HOURS = "CUSTOM_HOURS"
}
export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
}
export interface ApiResponse<T = void> {
    success: boolean;
    data?: T;
    message?: string;
    errors?: string[];
}
export interface JwtPayload {
    sub: string;
    email: string;
    tenantId?: string;
    role?: TenantRole;
    isSuperAdmin: boolean;
}
export type PlanTier = 'trial' | 'standard' | 'pro';
export interface PlanConfig {
    tier: PlanTier;
    label: string;
    amount: number;
    currency: string;
    maxProfessionals: number | null;
    reason: string;
}
export declare const PLANS: Record<Exclude<PlanTier, 'trial'>, PlanConfig>;
export interface TimeSlot {
    startAt: string;
    endAt: string;
    available: boolean;
}
export interface AvailabilityRequest {
    professionalId: string;
    serviceIds: string[];
    date: string;
}
