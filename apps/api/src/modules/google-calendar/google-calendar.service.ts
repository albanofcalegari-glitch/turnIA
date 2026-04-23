import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Prisma } from '@prisma/client'
import { google, calendar_v3 } from 'googleapis'
import { PrismaService } from '../../prisma/prisma.service'

interface TenantGoogleConfig {
  googleRefreshToken?: string
  googleCalendarId?:   string
  googleEmail?:        string
  googleSyncEnabled?:  boolean
}

interface CalendarEvent {
  appointmentId: string
  tenantId:      string
  summary:       string
  description:   string
  startAt:       Date
  endAt:         Date
  location?:     string
}

@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name)
  private readonly clientId:     string
  private readonly clientSecret: string
  private readonly redirectUri:  string

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.clientId     = this.config.get<string>('GOOGLE_CLIENT_ID')     ?? ''
    this.clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET') ?? ''
    this.redirectUri  = this.config.get<string>('GOOGLE_REDIRECT_URI')  ?? 'http://localhost:3000/dashboard/configuracion'
  }

  private get configured(): boolean {
    return !!(this.clientId && this.clientSecret)
  }

  private createOAuth2Client() {
    return new google.auth.OAuth2(this.clientId, this.clientSecret, this.redirectUri)
  }

  // ── OAuth Flow ────────────────────────────────────────────────────────────

  getAuthUrl(tenantId: string): string {
    const oauth2 = this.createOAuth2Client()
    return oauth2.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/userinfo.email',
      ],
      state: tenantId,
    })
  }

  async handleCallback(code: string, tenantId: string): Promise<{ email: string }> {
    const oauth2 = this.createOAuth2Client()
    const { tokens } = await oauth2.getToken(code)
    oauth2.setCredentials(tokens)

    // Get the user's email
    const oauth2Api = google.oauth2({ version: 'v2', auth: oauth2 })
    const { data: userInfo } = await oauth2Api.userinfo.get()
    const email = userInfo.email ?? 'desconocido'

    // Store in tenant settings
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    })
    const currentSettings = (tenant?.settings as Record<string, unknown>) ?? {}

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        settings: {
          ...currentSettings,
          googleRefreshToken: tokens.refresh_token,
          googleCalendarId:   'primary',
          googleEmail:        email,
          googleSyncEnabled:  true,
        },
      },
    })

    return { email }
  }

  async disconnect(tenantId: string): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    })
    const currentSettings = (tenant?.settings as Record<string, unknown>) ?? {}

    const { googleRefreshToken, googleCalendarId, googleEmail, googleSyncEnabled, ...rest } = currentSettings
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { settings: rest as Prisma.InputJsonValue },
    })
  }

  async getStatus(tenantId: string): Promise<{
    connected: boolean
    email:     string | null
    enabled:   boolean
  }> {
    const config = await this.getConfig(tenantId)
    return {
      connected: !!config.googleRefreshToken,
      email:     config.googleEmail ?? null,
      enabled:   config.googleSyncEnabled ?? false,
    }
  }

  async setEnabled(tenantId: string, enabled: boolean): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    })
    const currentSettings = (tenant?.settings as Record<string, unknown>) ?? {}

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        settings: { ...currentSettings, googleSyncEnabled: enabled },
      },
    })
  }

  // ── Calendar Operations ───────────────────────────────────────────────────

  async createEvent(event: CalendarEvent): Promise<string | null> {
    const client = await this.getCalendarClient(event.tenantId)
    if (!client) return null

    try {
      const config = await this.getConfig(event.tenantId)
      const res = await client.events.insert({
        calendarId: config.googleCalendarId || 'primary',
        requestBody: {
          summary:     event.summary,
          description: event.description,
          location:    event.location,
          start:       { dateTime: event.startAt.toISOString() },
          end:         { dateTime: event.endAt.toISOString() },
          reminders:   { useDefault: true },
        },
      })

      const eventId = res.data.id ?? null
      if (eventId) {
        await this.prisma.appointment.update({
          where: { id: event.appointmentId },
          data:  { googleCalendarEventId: eventId },
        })
      }
      this.logger.log(`Google Calendar event created: ${eventId} for appointment ${event.appointmentId}`)
      return eventId
    } catch (err) {
      this.logger.error(`Failed to create Google Calendar event for appointment ${event.appointmentId}`, err)
      return null
    }
  }

  async updateEvent(
    tenantId:    string,
    gcalEventId: string,
    updates:     Partial<{ summary: string; description: string; startAt: Date; endAt: Date; status: string }>,
  ): Promise<boolean> {
    const client = await this.getCalendarClient(tenantId)
    if (!client) return false

    try {
      const config = await this.getConfig(tenantId)
      const calendarId = config.googleCalendarId || 'primary'

      const patch: calendar_v3.Schema$Event = {}
      if (updates.summary)     patch.summary = updates.summary
      if (updates.description) patch.description = updates.description
      if (updates.startAt)     patch.start = { dateTime: updates.startAt.toISOString() }
      if (updates.endAt)       patch.end   = { dateTime: updates.endAt.toISOString() }
      if (updates.status === 'cancelled') patch.status = 'cancelled'

      await client.events.patch({
        calendarId,
        eventId: gcalEventId,
        requestBody: patch,
      })
      this.logger.log(`Google Calendar event updated: ${gcalEventId}`)
      return true
    } catch (err) {
      this.logger.error(`Failed to update Google Calendar event ${gcalEventId}`, err)
      return false
    }
  }

  async deleteEvent(tenantId: string, gcalEventId: string): Promise<boolean> {
    const client = await this.getCalendarClient(tenantId)
    if (!client) return false

    try {
      const config = await this.getConfig(tenantId)
      await client.events.delete({
        calendarId: config.googleCalendarId || 'primary',
        eventId:    gcalEventId,
      })
      this.logger.log(`Google Calendar event deleted: ${gcalEventId}`)
      return true
    } catch (err) {
      this.logger.error(`Failed to delete Google Calendar event ${gcalEventId}`, err)
      return false
    }
  }

  // ── Sync helper (called from AppointmentsService) ─────────────────────

  async syncAppointmentCreated(appointmentId: string): Promise<void> {
    const appt = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        professional: { select: { displayName: true } },
        items:        { select: { serviceName: true } },
        tenant:       { select: { name: true, timezone: true, settings: true } },
      },
    })
    if (!appt) return

    const config = this.extractConfig(appt.tenant.settings)
    if (!config.googleSyncEnabled || !config.googleRefreshToken) return

    const services = appt.items.map(i => i.serviceName).join(', ')
    const clientName = appt.guestName ?? 'Cliente'

    await this.createEvent({
      appointmentId: appt.id,
      tenantId:      appt.tenantId,
      summary:       `${services} — ${clientName}`,
      description:   [
        `Profesional: ${appt.professional.displayName}`,
        `Cliente: ${clientName}`,
        appt.guestEmail ? `Email: ${appt.guestEmail}` : '',
        appt.guestPhone ? `Tel: ${appt.guestPhone}` : '',
        appt.notes ? `Notas: ${appt.notes}` : '',
      ].filter(Boolean).join('\n'),
      startAt:  appt.startAt,
      endAt:    appt.endAt,
    })
  }

  async syncAppointmentUpdated(appointmentId: string): Promise<void> {
    const appt = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        professional: { select: { displayName: true } },
        items:        { select: { serviceName: true } },
        tenant:       { select: { settings: true } },
      },
    })
    if (!appt?.googleCalendarEventId) return

    const config = this.extractConfig(appt.tenant.settings)
    if (!config.googleSyncEnabled) return

    const services = appt.items.map(i => i.serviceName).join(', ')
    const clientName = appt.guestName ?? 'Cliente'

    await this.updateEvent(appt.tenantId, appt.googleCalendarEventId, {
      summary:   `${services} — ${clientName}`,
      startAt:   appt.startAt,
      endAt:     appt.endAt,
    })
  }

  async syncAppointmentCancelled(appointmentId: string): Promise<void> {
    const appt = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { tenantId: true, googleCalendarEventId: true, tenant: { select: { settings: true } } },
    })
    if (!appt?.googleCalendarEventId) return

    const config = this.extractConfig(appt.tenant.settings)
    if (!config.googleSyncEnabled) return

    await this.deleteEvent(appt.tenantId, appt.googleCalendarEventId)

    await this.prisma.appointment.update({
      where: { id: appointmentId },
      data:  { googleCalendarEventId: null },
    })
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async getConfig(tenantId: string): Promise<TenantGoogleConfig> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    })
    return this.extractConfig(tenant?.settings)
  }

  private extractConfig(settings: unknown): TenantGoogleConfig {
    if (!settings || typeof settings !== 'object') return {}
    return settings as TenantGoogleConfig
  }

  private async getCalendarClient(tenantId: string): Promise<calendar_v3.Calendar | null> {
    if (!this.configured) return null

    const config = await this.getConfig(tenantId)
    if (!config.googleRefreshToken) return null

    const oauth2 = this.createOAuth2Client()
    oauth2.setCredentials({ refresh_token: config.googleRefreshToken })

    return google.calendar({ version: 'v3', auth: oauth2 })
  }
}
