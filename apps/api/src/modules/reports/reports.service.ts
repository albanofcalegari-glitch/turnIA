import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

export interface MonthlyMetrics {
  month:         string // YYYY-MM
  appointments:  number
  services:      number // total de servicios ofrecidos (suma de items)
  uniqueClients: number
}

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Devuelve métricas mensuales para los últimos `months` meses (incluido el
   * actual). Cuenta solo turnos en estados "productivos" (CONFIRMED/COMPLETED/
   * PENDING) — los cancelados / no_show no se suman a servicios ni clientes.
   */
  async getMonthly(tenantId: string, months = 6): Promise<MonthlyMetrics[]> {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1)

    const appointments = await this.prisma.appointment.findMany({
      where: {
        tenantId,
        startAt: { gte: start },
        status:  { in: ['PENDING', 'CONFIRMED', 'COMPLETED'] },
      },
      select: {
        startAt:    true,
        clientId:   true,
        guestEmail: true,
        items:      { select: { id: true } },
      },
    })

    // Pre-cargo los meses para que aparezcan incluso si no hay data.
    const buckets = new Map<string, {
      appointments: number
      services:     number
      clients:      Set<string>
    }>()
    for (let i = 0; i < months; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1)
      buckets.set(monthKey(d), { appointments: 0, services: 0, clients: new Set() })
    }

    for (const a of appointments) {
      const key = monthKey(a.startAt)
      const bucket = buckets.get(key)
      if (!bucket) continue // por si quedó fuera del rango

      bucket.appointments += 1
      bucket.services     += a.items.length
      // Identidad del cliente: clientId si está logueado, guestEmail si es invitado.
      const clientKey = a.clientId ?? (a.guestEmail ? `guest:${a.guestEmail.toLowerCase()}` : null)
      if (clientKey) bucket.clients.add(clientKey)
    }

    return Array.from(buckets.entries()).map(([month, v]) => ({
      month,
      appointments:  v.appointments,
      services:      v.services,
      uniqueClients: v.clients.size,
    }))
  }
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
