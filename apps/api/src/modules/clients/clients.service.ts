import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async search(tenantId: string, query: string, limit = 10) {
    const q = query.trim()
    if (!q) return []

    return this.prisma.client.findMany({
      where: {
        tenantId,
        isActive: true,
        OR: [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName:  { contains: q, mode: 'insensitive' } },
          { email:     { contains: q, mode: 'insensitive' } },
          { phone:     { contains: q, mode: 'insensitive' } },
        ],
      },
      select: {
        id:        true,
        firstName: true,
        lastName:  true,
        email:     true,
        phone:     true,
      },
      orderBy: { firstName: 'asc' },
      take:    limit,
    })
  }
}
