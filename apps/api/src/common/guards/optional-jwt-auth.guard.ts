import { Injectable } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'

/**
 * Like JwtAuthGuard but never throws.
 * If a valid Bearer token is present, populates req.user normally.
 * If no token (or invalid token), req.user is set to null.
 *
 * Use on endpoints that support both authenticated clients and guests,
 * such as POST /appointments where both paths are valid.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  override handleRequest(_err: any, user: any): any {
    return user ?? null
  }
}
