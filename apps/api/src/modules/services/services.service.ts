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

  async findAll(tenantId: string, options: { excludeComplex?: boolean } = {}) {
    // When `excludeComplex` is set (guest booking catalog), hide services that
    // can only be fulfilled via a WorkOrder (multi-professional or multi-day).
    // Those services are admin-created on behalf of clients and don't have a
    // self-service booking flow in Phase 1.
    const complexFilter = options.excludeComplex
      ? { minProfessionals: { lte: 1 }, allowsMultiDay: false }
      : {}
    return this.prisma.service.findMany({
      where:   { tenantId, isActive: true, ...complexFilter },
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
