import { Injectable } from '@nestjs/common'
import { AppointmentStatus } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'

export interface MonthlyMetrics {
  month:         string
  appointments:  number
  services:      number
  uniqueClients: number
}

export interface DashboardStats {
  period: { from: string; to: string }
  kpis: {
    totalAppointments:     number
    completedAppointments: number
    cancelledAppointments: number
    noShowAppointments:    number
    pendingAppointments:   number
    confirmedAppointments: number
    totalServices:         number
    revenue:               number
    uniqueClients:         number
    appointmentsDelta:     number
    servicesDelta:         number
    revenueDelta:          number
    clientsDelta:          number
  }
  rates: { cancellation: number; completion: number; noShow: number }
  topProfessionals: Array<{
    id:             string
    displayName:    string
    avatarUrl:      string | null
    color:          string | null
    completedCount: number
    totalCount:     number
  }>
  topServices: Array<{ serviceName: string; count: number }>
  appointmentsByHour:      Array<{ hour: number; count: number }>
  appointmentsByDayOfWeek: Array<{ day: number; count: number }>
  monthlyEvolution: Array<{
    month:         string
    appointments:  number
    services:      number
    uniqueClients: number
    revenue:       number
    cancelled:     number
  }>
  clients: { newClients: number; recurringClients: number }
}

const PRODUCTIVE: AppointmentStatus[] = [
  AppointmentStatus.PENDING,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.COMPLETED,
]

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  // ── Existing monthly endpoint (Pro-only) ──────────────────────────────────

  async getMonthly(tenantId: string, months = 6): Promise<MonthlyMetrics[]> {
    const now   = new Date()
    const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1)

    const appointments = await this.prisma.appointment.findMany({
      where: {
        tenantId,
        startAt: { gte: start },
        status:  { in: PRODUCTIVE },
      },
      select: {
        startAt:    true,
        clientId:   true,
        guestEmail: true,
        items:      { select: { id: true } },
      },
    })

    const buckets = new Map<string, { appointments: number; services: number; clients: Set<string> }>()
    for (let i = 0; i < months; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1)
      buckets.set(monthKey(d), { appointments: 0, services: 0, clients: new Set() })
    }

    for (const a of appointments) {
      const bucket = buckets.get(monthKey(a.startAt))
      if (!bucket) continue
      bucket.appointments += 1
      bucket.services     += a.items.length
      const ck = a.clientId ?? (a.guestEmail ? `guest:${a.guestEmail.toLowerCase()}` : null)
      if (ck) bucket.clients.add(ck)
    }

    return Array.from(buckets.entries()).map(([month, v]) => ({
      month,
      appointments:  v.appointments,
      services:      v.services,
      uniqueClients: v.clients.size,
    }))
  }

  // ── Dashboard stats (all plans) ───────────────────────────────────────────

  async getDashboardStats(
    tenantId: string,
    opts: { period?: string; professionalId?: string } = {},
  ): Promise<DashboardStats> {
    const now = new Date()

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { timezone: true },
    })
    const tz = tenant?.timezone ?? 'America/Argentina/Buenos_Aires'

    // ── Period boundaries ────────────────────────────────────────────────
    let periodStart: Date, periodEnd: Date, prevStart: Date
    const period = opts.period ?? 'current_month'

    if (period === 'last_month') {
      periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      periodEnd   = new Date(now.getFullYear(), now.getMonth(), 1)
      prevStart   = new Date(now.getFullYear(), now.getMonth() - 2, 1)
    } else if (period === 'last_3_months') {
      periodStart = new Date(now.getFullYear(), now.getMonth() - 2, 1)
      periodEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      prevStart   = new Date(now.getFullYear(), now.getMonth() - 5, 1)
    } else {
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
      periodEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      prevStart   = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    }

    const evolutionStart = new Date(now.getFullYear(), now.getMonth() - 5, 1)
    const fetchStart = new Date(Math.min(prevStart.getTime(), evolutionStart.getTime()))
    const proFilter  = opts.professionalId ? { professionalId: opts.professionalId } : {}

    // ── Single bulk query ────────────────────────────────────────────────
    const allAppts = await this.prisma.appointment.findMany({
      where: {
        tenantId,
        startAt: { gte: fetchStart, lt: periodEnd },
        status:  { not: 'RESCHEDULED' },
        ...proFilter,
      },
      select: {
        id:             true,
        status:         true,
        startAt:        true,
        totalPrice:     true,
        clientId:       true,
        guestEmail:     true,
        professionalId: true,
        items:          { select: { serviceName: true } },
        professional:   { select: { id: true, displayName: true, avatarUrl: true, color: true } },
      },
    })

    const currentAppts = allAppts.filter(a => a.startAt >= periodStart && a.startAt < periodEnd)
    const prevAppts    = allAppts.filter(a => a.startAt >= prevStart   && a.startAt < periodStart)

    // ── KPIs ─────────────────────────────────────────────────────────────
    const completed  = currentAppts.filter(a => a.status === 'COMPLETED')
    const cancelled  = currentAppts.filter(a => a.status === 'CANCELLED')
    const noShow     = currentAppts.filter(a => a.status === 'NO_SHOW')
    const pending    = currentAppts.filter(a => a.status === 'PENDING')
    const confirmed  = currentAppts.filter(a => a.status === 'CONFIRMED')
    const productive = currentAppts.filter(a => PRODUCTIVE.includes(a.status))

    const totalServices  = productive.reduce((s, a) => s + a.items.length, 0)
    const revenue        = completed.reduce((s, a) => s + Number(a.totalPrice), 0)
    const uniqueClients  = countUniqueClients(productive)

    const prevProductive    = prevAppts.filter(a => PRODUCTIVE.includes(a.status))
    const prevCompleted     = prevAppts.filter(a => a.status === 'COMPLETED')
    const prevTotalServices = prevProductive.reduce((s, a) => s + a.items.length, 0)
    const prevRevenue       = prevCompleted.reduce((s, a) => s + Number(a.totalPrice), 0)
    const prevUniqueClients = countUniqueClients(prevProductive)

    const total            = currentAppts.length
    const cancellationRate = total > 0 ? Math.round((cancelled.length / total) * 100) : 0
    const completionRate   = total > 0 ? Math.round((completed.length / total) * 100) : 0
    const noShowRate       = total > 0 ? Math.round((noShow.length / total) * 100) : 0

    // ── Top Professionals ────────────────────────────────────────────────
    const proMap = new Map<string, {
      pro: { id: string; displayName: string; avatarUrl: string | null; color: string | null }
      completed: number; total: number
    }>()
    for (const a of currentAppts) {
      if (!proMap.has(a.professionalId)) {
        proMap.set(a.professionalId, { pro: a.professional, completed: 0, total: 0 })
      }
      const e = proMap.get(a.professionalId)!
      e.total++
      if (a.status === 'COMPLETED') e.completed++
    }
    const topProfessionals = [...proMap.values()]
      .sort((a, b) => b.completed - a.completed)
      .slice(0, 10)
      .map(e => ({ ...e.pro, completedCount: e.completed, totalCount: e.total }))

    // ── Top Services ─────────────────────────────────────────────────────
    const svcMap = new Map<string, number>()
    for (const a of productive) {
      for (const item of a.items) svcMap.set(item.serviceName, (svcMap.get(item.serviceName) ?? 0) + 1)
    }
    const topServices = [...svcMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([serviceName, count]) => ({ serviceName, count }))

    // ── Peak Hours & Days (timezone-aware) ───────────────────────────────
    const hourCounts = new Array(24).fill(0)
    const dayCounts  = new Array(7).fill(0)
    for (const a of productive) {
      hourCounts[getLocalHour(a.startAt, tz)]++
      dayCounts[getLocalIsoDay(a.startAt, tz)]++
    }

    // ── Monthly Evolution (6 months) ─────────────────────────────────────
    const monthBuckets = new Map<string, {
      appointments: number; services: number; clients: Set<string>
      revenue: number; cancelled: number
    }>()
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
      monthBuckets.set(monthKey(d), {
        appointments: 0, services: 0, clients: new Set(), revenue: 0, cancelled: 0,
      })
    }
    for (const a of allAppts) {
      if (a.startAt < evolutionStart) continue
      const bucket = monthBuckets.get(monthKey(a.startAt))
      if (!bucket) continue
      if (PRODUCTIVE.includes(a.status)) {
        bucket.appointments++
        bucket.services += a.items.length
        const ck = a.clientId ?? (a.guestEmail ? `guest:${a.guestEmail.toLowerCase()}` : null)
        if (ck) bucket.clients.add(ck)
        if (a.status === 'COMPLETED') bucket.revenue += Number(a.totalPrice)
      }
      if (a.status === 'CANCELLED') bucket.cancelled++
    }
    const monthlyEvolution = [...monthBuckets.entries()].map(([month, v]) => ({
      month,
      appointments:  v.appointments,
      services:      v.services,
      uniqueClients: v.clients.size,
      revenue:       Math.round(v.revenue),
      cancelled:     v.cancelled,
    }))

    // ── New vs Recurring Clients ─────────────────────────────────────────
    const currentClientIds = [...new Set(productive.filter(a => a.clientId).map(a => a.clientId!))]
    let returningCount = 0
    if (currentClientIds.length > 0) {
      const returning = await this.prisma.appointment.findMany({
        where: {
          tenantId,
          clientId: { in: currentClientIds },
          startAt:  { lt: periodStart },
          status:   { in: ['CONFIRMED', 'COMPLETED'] },
        },
        select:   { clientId: true },
        distinct: ['clientId'],
      })
      returningCount = returning.length
    }
    const guestSet = new Set<string>()
    for (const a of productive) {
      if (!a.clientId && a.guestEmail) guestSet.add(a.guestEmail.toLowerCase())
    }

    // ── Response ─────────────────────────────────────────────────────────
    return {
      period: {
        from: periodStart.toISOString().split('T')[0],
        to:   new Date(Math.min(now.getTime(), periodEnd.getTime() - 1)).toISOString().split('T')[0],
      },
      kpis: {
        totalAppointments:     total,
        completedAppointments: completed.length,
        cancelledAppointments: cancelled.length,
        noShowAppointments:    noShow.length,
        pendingAppointments:   pending.length,
        confirmedAppointments: confirmed.length,
        totalServices,
        revenue:           Math.round(revenue),
        uniqueClients,
        appointmentsDelta: productive.length - prevProductive.length,
        servicesDelta:     totalServices - prevTotalServices,
        revenueDelta:      Math.round(revenue - prevRevenue),
        clientsDelta:      uniqueClients - prevUniqueClients,
      },
      rates: { cancellation: cancellationRate, completion: completionRate, noShow: noShowRate },
      topProfessionals,
      topServices,
      appointmentsByHour:      hourCounts.map((count, hour) => ({ hour, count })),
      appointmentsByDayOfWeek: dayCounts.map((count, day) => ({ day, count })),
      monthlyEvolution,
      clients: {
        newClients:       currentClientIds.length - returningCount + guestSet.size,
        recurringClients: returningCount,
      },
    }
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function countUniqueClients(appts: Array<{ clientId: string | null; guestEmail: string | null }>): number {
  const seen = new Set<string>()
  for (const a of appts) {
    const key = a.clientId ?? (a.guestEmail ? `guest:${a.guestEmail.toLowerCase()}` : null)
    if (key) seen.add(key)
  }
  return seen.size
}

function getLocalHour(date: Date, tz: string): number {
  const h = new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: tz }).format(date)
  return parseInt(h, 10) % 24
}

function getLocalIsoDay(date: Date, tz: string): number {
  const s = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: tz }).format(date)
  const m: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }
  return m[s] ?? 0
}
