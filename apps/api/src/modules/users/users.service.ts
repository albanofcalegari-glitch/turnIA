import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, firstName: true, lastName: true, phone: true, avatarUrl: true, isActive: true, createdAt: true },
    })
    if (!user) throw new NotFoundException('Usuario no encontrado')
    return user
  }

  async findByTenant(tenantId: string) {
    return this.prisma.tenantUser.findMany({
      where: { tenantId },
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true, isActive: true } } },
    })
  }
}
