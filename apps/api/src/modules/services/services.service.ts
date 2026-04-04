import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { CreateServiceDto } from './dto/create-service.dto'

@Injectable()
export class ServicesService {
  constructor(private prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateServiceDto) {
    return this.prisma.service.create({
      data: { ...dto, tenantId },
    })
  }

  async findAll(tenantId: string) {
    return this.prisma.service.findMany({
      where:   { tenantId, isActive: true },
      include: { category: true },
      orderBy: { name: 'asc' },
    })
  }

  async findOne(tenantId: string, id: string) {
    const service = await this.prisma.service.findFirst({
      where:   { id, tenantId },
      include: { category: true, professionals: { include: { professional: true } } },
    })
    if (!service) throw new NotFoundException('Servicio no encontrado')
    return service
  }

  async update(tenantId: string, id: string, dto: Partial<CreateServiceDto>) {
    await this.findOne(tenantId, id)
    return this.prisma.service.update({ where: { id }, data: dto })
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id)
    return this.prisma.service.update({ where: { id }, data: { isActive: false } })
  }
}
