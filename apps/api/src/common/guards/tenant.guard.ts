import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common'

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const request = ctx.switchToHttp().getRequest()
    if (!request.tenantId) {
      throw new ForbiddenException('Se requiere contexto de negocio')
    }
    return true
  }
}
