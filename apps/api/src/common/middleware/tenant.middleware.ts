import { Injectable, NestMiddleware } from '@nestjs/common'
import { Request, Response, NextFunction } from 'express'

// El tenant se puede resolver de 3 formas (en orden de prioridad):
// 1. Header: X-Tenant-ID
// 2. Header: X-Tenant-Slug
// 3. Subdominio: tenant-slug.turnia.com
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request & { tenantId?: string; tenantSlug?: string }, _res: Response, next: NextFunction) {
    const tenantId   = req.headers['x-tenant-id'] as string | undefined
    const tenantSlug = req.headers['x-tenant-slug'] as string | undefined

    if (tenantId) {
      req.tenantId = tenantId
    } else if (tenantSlug) {
      req.tenantSlug = tenantSlug
    } else {
      // Intentar extraer del host: barberia-juan.turnia.com
      const host = req.hostname
      const sub  = host.split('.')[0]
      if (sub && sub !== 'www' && sub !== 'api') {
        req.tenantSlug = sub
      }
    }

    next()
  }
}
