import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { CreateBranchDto } from './dto/create-branch.dto'
import { UpdateBranchDto } from './dto/update-branch.dto'

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Read
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Returns every branch (active or not) for the current tenant.
   * Used by the admin dashboard. Default branch first, then by `order`.
   */
  async findAllByTenant(tenantId: string) {
    return this.prisma.branch.findMany({
      where:   { tenantId },
      orderBy: [
        { isDefault: 'desc' },
        { order:     'asc'  },
        { createdAt: 'asc'  },
      ],
    })
  }

  /**
   * Returns only active branches for the current tenant.
   * Used by the public booking flow. Strips internal fields.
   */
  async findActiveByTenant(tenantId: string) {
    return this.prisma.branch.findMany({
      where:   { tenantId, isActive: true },
      orderBy: [
        { isDefault: 'desc' },
        { order:     'asc'  },
      ],
      select: {
        id:        true,
        name:      true,
        slug:      true,
        address:   true,
        phone:     true,
        timezone:  true,
        isDefault: true,
        order:     true,
      },
    })
  }

  async findOne(tenantId: string, id: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id, tenantId },
    })
    if (!branch) throw new NotFoundException('Sucursal no encontrada')
    return branch
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Write
  // ─────────────────────────────────────────────────────────────────────────

  async create(tenantId: string, dto: CreateBranchDto) {
    const slug = dto.slug ?? this.slugify(dto.name)
    if (!slug) {
      throw new BadRequestException('No se pudo generar un identificador para la sucursal')
    }

    try {
      return await this.prisma.branch.create({
        data: {
          tenantId,
          name:      dto.name,
          slug,
          address:   dto.address  ?? null,
          phone:     dto.phone    ?? null,
          timezone:  dto.timezone ?? null,
          order:     dto.order    ?? 0,
          isActive:  true,
          // Only the branch created during onboarding is the default; any
          // branch added later is non-default. The default branch is the
          // anchor that backwards-compatibility code falls back to.
          isDefault: false,
        },
      })
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Ya existe una sucursal con ese identificador')
      }
      throw err
    }
  }

  async update(tenantId: string, id: string, dto: UpdateBranchDto) {
    // Verify ownership before updating — prevents cross-tenant edits.
    await this.findOne(tenantId, id)

    try {
      return await this.prisma.branch.update({
        where: { id },
        data: {
          name:     dto.name     ?? undefined,
          slug:     dto.slug     ?? undefined,
          address:  dto.address  ?? undefined,
          phone:    dto.phone    ?? undefined,
          timezone: dto.timezone ?? undefined,
          order:    dto.order    ?? undefined,
          isActive: dto.isActive ?? undefined,
        },
      })
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Ya existe una sucursal con ese identificador')
      }
      throw err
    }
  }

  /**
   * Soft-delete: marks the branch isActive=false. We never hard-delete
   * because work_schedules / appointments / resources still FK into it.
   *
   * Refuses to deactivate:
   *  - the default branch (it is the backwards-compat anchor)
   *  - the last active branch of the tenant (would leave nowhere to book)
   */
  async remove(tenantId: string, id: string) {
    const branch = await this.findOne(tenantId, id)

    if (branch.isDefault) {
      throw new BadRequestException('No podés eliminar la sucursal principal')
    }

    if (!branch.isActive) {
      // Idempotent: already inactive.
      return branch
    }

    const remainingActive = await this.prisma.branch.count({
      where: { tenantId, isActive: true, id: { not: id } },
    })
    if (remainingActive === 0) {
      throw new BadRequestException('Debe quedar al menos una sucursal activa')
    }

    return this.prisma.branch.update({
      where: { id },
      data:  { isActive: false },
    })
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Phase 2 helpers — branch resolution + professional/branch authorization
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Resolves the branchId that an inbound request should operate on.
   *
   * - If `requested` is provided, validates that the branch exists, belongs
   *   to the tenant and is active. Throws NotFoundException otherwise.
   * - If `requested` is omitted, falls back to the tenant's only active
   *   branch (single-location tenants get this for free, no UI changes
   *   required). If the tenant has zero or more than one active branch,
   *   the caller must send branchId explicitly: throws BadRequestException.
   *
   * IMPORTANT: the fallback uses the actual count of active branches, not
   * the `Tenant.hasMultipleBranches` flag, because that flag is purely a
   * UI hint. A tenant could legitimately have several branches with
   * `hasMultipleBranches=false` (e.g. mid-migration) and we still want
   * inbound requests to fail loudly instead of silently picking one.
   */
  async resolveBranchId(tenantId: string, requested?: string | null): Promise<string> {
    if (requested) {
      const branch = await this.prisma.branch.findFirst({
        where:  { id: requested, tenantId, isActive: true },
        select: { id: true },
      })
      if (!branch) {
        throw new NotFoundException('Sucursal no encontrada o inactiva')
      }
      return branch.id
    }

    const active = await this.prisma.branch.findMany({
      where:   { tenantId, isActive: true },
      orderBy: [{ isDefault: 'desc' }, { order: 'asc' }],
      select:  { id: true },
      take:    2,
    })

    if (active.length === 0) {
      throw new BadRequestException('El negocio no tiene sucursales activas')
    }
    if (active.length > 1) {
      throw new BadRequestException('Debés especificar la sucursal (branchId)')
    }
    return active[0].id
  }

  /**
   * Verifies that a professional is linked to a given branch via the
   * `professional_branches` join table. Throws BadRequestException if not.
   * Used by the slot engine and the appointment writes to enforce that a
   * professional cannot be booked at a sucursal where they don't atender.
   */
  async requireProfessionalInBranch(branchId: string, professionalId: string): Promise<void> {
    const link = await this.prisma.professionalBranch.findUnique({
      where:  { professionalId_branchId: { professionalId, branchId } },
      select: { professionalId: true },
    })
    if (!link) {
      throw new BadRequestException('El profesional no atiende en esta sucursal')
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  private slugify(input: string): string {
    return input
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
  }
}
