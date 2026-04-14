import { SetMetadata } from '@nestjs/common'

/**
 * Opt a route out of the MembershipGuard. Used on endpoints that must work
 * even when the tenant's subscription is expired — e.g. /subscriptions/me
 * (so the admin can pay to reactivate) and the auth endpoints.
 *
 * Public booking endpoints already bypass the guard because they have no
 * authenticated user attached; this decorator is only relevant for routes
 * under JwtAuthGuard.
 */
export const SKIP_MEMBERSHIP_CHECK_KEY = 'skipMembershipCheck'
export const SkipMembershipCheck = () => SetMetadata(SKIP_MEMBERSHIP_CHECK_KEY, true)
