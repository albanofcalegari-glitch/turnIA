import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { promises as fs } from 'fs'
import { dirname, extname, join } from 'path'
import { randomUUID } from 'crypto'
import { PrismaService } from '../../prisma/prisma.service'

const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/pdf',
])

const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

/** Raíz de archivos en disco. Puede sobrescribirse con UPLOADS_DIR. */
const UPLOADS_ROOT = process.env.UPLOADS_DIR
  || join(process.cwd(), 'uploads')

@Injectable()
export class AttachmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, appointmentId: string) {
    await this.assertAppointmentInTenant(tenantId, appointmentId)
    return this.prisma.appointmentAttachment.findMany({
      where:   { appointmentId },
      orderBy: { createdAt: 'desc' },
    })
  }

  async create(
    tenantId: string,
    appointmentId: string,
    uploadedById: string,
    file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Archivo requerido')
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException('Tipo de archivo no permitido')
    }
    if (file.size > MAX_SIZE_BYTES) {
      throw new BadRequestException('El archivo supera los 10 MB')
    }

    await this.assertAppointmentInTenant(tenantId, appointmentId)

    // Store as appointments/{id}/{uuid}{ext}
    const ext      = extname(file.originalname) || guessExt(file.mimetype)
    const fileId   = randomUUID()
    const relative = `/uploads/appointments/${appointmentId}/${fileId}${ext}`
    const absolute = join(UPLOADS_ROOT, 'appointments', appointmentId, `${fileId}${ext}`)

    await fs.mkdir(dirname(absolute), { recursive: true })
    await fs.writeFile(absolute, file.buffer)

    return this.prisma.appointmentAttachment.create({
      data: {
        appointmentId,
        url:         relative,
        filename:    file.originalname,
        mimeType:    file.mimetype,
        sizeBytes:   file.size,
        uploadedById,
      },
    })
  }

  async remove(tenantId: string, appointmentId: string, attachmentId: string) {
    await this.assertAppointmentInTenant(tenantId, appointmentId)

    const att = await this.prisma.appointmentAttachment.findFirst({
      where: { id: attachmentId, appointmentId },
    })
    if (!att) throw new NotFoundException('Adjunto no encontrado')

    // Best-effort disk cleanup — even if the file is already gone the DB row
    // has to go so the UI stops listing it.
    const absolute = join(UPLOADS_ROOT, att.url.replace(/^\/uploads\//, ''))
    await fs.unlink(absolute).catch(() => { /* ignored */ })

    await this.prisma.appointmentAttachment.delete({ where: { id: attachmentId } })
    return { ok: true }
  }

  private async assertAppointmentInTenant(tenantId: string, appointmentId: string) {
    const appt = await this.prisma.appointment.findFirst({
      where:  { id: appointmentId, tenantId },
      select: { id: true },
    })
    if (!appt) throw new NotFoundException('Turno no encontrado')
  }
}

function guessExt(mime: string): string {
  switch (mime) {
    case 'image/png':      return '.png'
    case 'image/jpeg':     return '.jpg'
    case 'image/webp':     return '.webp'
    case 'image/gif':      return '.gif'
    case 'application/pdf': return '.pdf'
    default:               return ''
  }
}
