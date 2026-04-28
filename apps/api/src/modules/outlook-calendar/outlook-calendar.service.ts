import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'

interface TenantOutlookConfig {
  outlookRefreshToken?: string
  outlookCalendarId?:   string
  outlookEmail?:        string
  outlookSyncEnabled?:  boolean
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

interface MsTokenResponse {
  access_token:  string
  refresh_token?: string
  expires_in:    number
  token_type:    string
}

const MS_AUTH_BASE  = 'https://login.microsoftonline.com/common/oauth2/v2.0'
const MS_GRAPH_BASE = 'https://graph.microsoft.com/v1.0'

@Injectable()
export class OutlookCalendarService {
  private readonly logger = new Logger(OutlookCalendarService.name)
  private readonly clientId:     string
  private readonly clientSecret: string
  private readonly redirectUri:  string

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.clientId     = this.config.get<string>('MICROSOFT_CLIENT_ID')     ?? ''
    this.clientSecret = this.config.get<string>('MICROSOFT_CLIENT_SECRET') ?? ''
    this.redirectUri  = this.config.get<string>('MICROSOFT_REDIRECT_URI')  ?? 'http://localhost:3000/dashboard/configuracion'
  }

  private get configured(): boolean {
    return !!(this.clientId && this.clientSecret)
  }

  // ── OAuth Flow ────────────────────────────────────────────────────────────

  getAuthUrl(tenantId: string): string {
    const params = new URLSearchParams({
      client_id:     this.clientId,
      response_type: 'code',
      redirect_uri:  this.redirectUri,
      response_mode: 'query',
      scope:         'offline_access User.Read Calendars.ReadWrite',
      state:         tenantId,
      prompt:        'consent',
    })
    return `${MS_AUTH_BASE}/authorize?${params}`
  }

  async handleCallback(code: string, tenantId: string): Promise<{ email: string }> {
    const tokens = await this.exchangeCode(code)

    const email = await this.getUserEmail(tokens.access_token)

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
          outlookRefreshToken: tokens.refresh_token,
          outlookCalendarId:   'primary',
          outlookEmail:        email,
          outlookSyncEnabled:  true,
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

    const { outlookRefreshToken, outlookCalendarId, outlookEmail, outlookSyncEnabled, ...rest } = currentSettings
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
      connected: !!config.outlookRefreshToken,
      email:     config.outlookEmail ?? null,
      enabled:   config.outlookSyncEnabled ?? false,
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
        settings: { ...currentSettings, outlookSyncEnabled: enabled },
      },
    })
  }

  // ── Calendar Operations ───────────────────────────────────────────────────

  async createEvent(event: CalendarEvent): Promise<string | null> {
    const accessToken = await this.getAccessToken(event.tenantId)
    if (!accessToken) return null

    try {
      const body = {
        subject: event.summary,
        body:    { contentType: 'Text', content: event.description },
        start:   { dateTime: event.startAt.toISOString(), timeZone: 'UTC' },
        end:     { dateTime: event.endAt.toISOString(),   timeZone: 'UTC' },
        ...(event.location ? { location: { displayName: event.location } } : {}),
      }

      const res = await fetch(`${MS_GRAPH_BASE}/me/events`, {
        method: 'POST',
        headers: {
          Authorization:  `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        this.logger.error(`Outlook create event failed: ${res.status} ${await res.text()}`)
        return null
      }

      const data = await res.json() as { id: string }
      if (data.id) {
        await this.prisma.appointment.update({
          where: { id: event.appointmentId },
          data:  { outlookCalendarEventId: data.id },
        })
      }
      this.logger.log(`Outlook Calendar event created: ${data.id} for appointment ${event.appointmentId}`)
      return data.id
    } catch (err) {
      this.logger.error(`Failed to create Outlook Calendar event for appointment ${event.appointmentId}`, err)
      return null
    }
  }

  async updateEvent(
    tenantId:       string,
    outlookEventId: string,
    updates:        Partial<{ summary: string; description: string; startAt: Date; endAt: Date }>,
  ): Promise<boolean> {
    const accessToken = await this.getAccessToken(tenantId)
    if (!accessToken) return false

    try {
      const patch: Record<string, unknown> = {}
      if (updates.summary)     patch.subject = updates.summary
      if (updates.description) patch.body = { contentType: 'Text', content: updates.description }
      if (updates.startAt)     patch.start = { dateTime: updates.startAt.toISOString(), timeZone: 'UTC' }
      if (updates.endAt)       patch.end   = { dateTime: updates.endAt.toISOString(),   timeZone: 'UTC' }

      const res = await fetch(`${MS_GRAPH_BASE}/me/events/${outlookEventId}`, {
        method: 'PATCH',
        headers: {
          Authorization:  `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(patch),
      })

      if (!res.ok) {
        this.logger.error(`Outlook update event failed: ${res.status}`)
        return false
      }
      this.logger.log(`Outlook Calendar event updated: ${outlookEventId}`)
      return true
    } catch (err) {
      this.logger.error(`Failed to update Outlook Calendar event ${outlookEventId}`, err)
      return false
    }
  }

  async deleteEvent(tenantId: string, outlookEventId: string): Promise<boolean> {
    const accessToken = await this.getAccessToken(tenantId)
    if (!accessToken) return false

    try {
      const res = await fetch(`${MS_GRAPH_BASE}/me/events/${outlookEventId}`, {
        method:  'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      })

      if (!res.ok && res.status !== 404) {
        this.logger.error(`Outlook delete event failed: ${res.status}`)
        return false
      }
      this.logger.log(`Outlook Calendar event deleted: ${outlookEventId}`)
      return true
    } catch (err) {
      this.logger.error(`Failed to delete Outlook Calendar event ${outlookEventId}`, err)
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
    if (!config.outlookSyncEnabled || !config.outlookRefreshToken) return

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
    if (!appt?.outlookCalendarEventId) return

    const config = this.extractConfig(appt.tenant.settings)
    if (!config.outlookSyncEnabled) return

    const services = appt.items.map(i => i.serviceName).join(', ')
    const clientName = appt.guestName ?? 'Cliente'

    await this.updateEvent(appt.tenantId, appt.outlookCalendarEventId, {
      summary: `${services} — ${clientName}`,
      startAt: appt.startAt,
      endAt:   appt.endAt,
    })
  }

  async syncAppointmentCancelled(appointmentId: string): Promise<void> {
    const appt = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { tenantId: true, outlookCalendarEventId: true, tenant: { select: { settings: true } } },
    })
    if (!appt?.outlookCalendarEventId) return

    const config = this.extractConfig(appt.tenant.settings)
    if (!config.outlookSyncEnabled) return

    await this.deleteEvent(appt.tenantId, appt.outlookCalendarEventId)

    await this.prisma.appointment.update({
      where: { id: appointmentId },
      data:  { outlookCalendarEventId: null },
    })
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async exchangeCode(code: string): Promise<MsTokenResponse> {
    const body = new URLSearchParams({
      client_id:     this.clientId,
      client_secret: this.clientSecret,
      code,
      redirect_uri:  this.redirectUri,
      grant_type:    'authorization_code',
      scope:         'offline_access User.Read Calendars.ReadWrite',
    })

    const res = await fetch(`${MS_AUTH_BASE}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`MS token exchange failed: ${res.status} ${text}`)
    }

    return res.json() as Promise<MsTokenResponse>
  }

  private async refreshAccessToken(refreshToken: string): Promise<MsTokenResponse> {
    const body = new URLSearchParams({
      client_id:     this.clientId,
      client_secret: this.clientSecret,
      refresh_token: refreshToken,
      grant_type:    'refresh_token',
      scope:         'offline_access User.Read Calendars.ReadWrite',
    })

    const res = await fetch(`${MS_AUTH_BASE}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })

    if (!res.ok) {
      throw new Error(`MS token refresh failed: ${res.status}`)
    }

    return res.json() as Promise<MsTokenResponse>
  }

  private async getUserEmail(accessToken: string): Promise<string> {
    const res = await fetch(`${MS_GRAPH_BASE}/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) return 'desconocido'
    const data = await res.json() as { mail?: string; userPrincipalName?: string }
    return data.mail ?? data.userPrincipalName ?? 'desconocido'
  }

  private async getAccessToken(tenantId: string): Promise<string | null> {
    if (!this.configured) return null

    const config = await this.getConfig(tenantId)
    if (!config.outlookRefreshToken) return null

    try {
      const tokens = await this.refreshAccessToken(config.outlookRefreshToken)

      if (tokens.refresh_token && tokens.refresh_token !== config.outlookRefreshToken) {
        const tenant = await this.prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { settings: true },
        })
        const currentSettings = (tenant?.settings as Record<string, unknown>) ?? {}
        await this.prisma.tenant.update({
          where: { id: tenantId },
          data: { settings: { ...currentSettings, outlookRefreshToken: tokens.refresh_token } },
        })
      }

      return tokens.access_token
    } catch (err) {
      this.logger.error(`Failed to refresh Outlook access token for tenant ${tenantId}`, err)
      return null
    }
  }

  private async getConfig(tenantId: string): Promise<TenantOutlookConfig> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    })
    return this.extractConfig(tenant?.settings)
  }

  private extractConfig(settings: unknown): TenantOutlookConfig {
    if (!settings || typeof settings !== 'object') return {}
    return settings as TenantOutlookConfig
  }
}
