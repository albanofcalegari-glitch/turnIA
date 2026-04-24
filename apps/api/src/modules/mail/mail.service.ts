import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Resend } from 'resend'

interface SendArgs {
  to:      string
  subject: string
  html:    string
  text?:   string
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name)
  private readonly resend: Resend | null
  private readonly from:   string
  private readonly webUrl: string

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('RESEND_API_KEY')
    this.from   = this.config.get<string>('MAIL_FROM')   ?? 'turnIT <onboarding@resend.dev>'
    this.webUrl = this.config.get<string>('WEB_URL')     ?? 'http://localhost:3000'
    this.resend = apiKey ? new Resend(apiKey) : null
    if (!this.resend) {
      this.logger.warn('RESEND_API_KEY not set — emails will be logged instead of sent')
    }
  }

  /** Envía un email transaccional. Si falla, loggea y devuelve false sin tirar — los flujos de auth no deben romperse por un mail caído. */
  async send(args: SendArgs): Promise<boolean> {
    if (!this.resend) {
      this.logger.log(`[mock email] to=${args.to} subject="${args.subject}"`)
      return true
    }
    try {
      const { error } = await this.resend.emails.send({
        from:    this.from,
        to:      args.to,
        subject: args.subject,
        html:    args.html,
        text:    args.text,
      })
      if (error) {
        this.logger.error(`Resend error sending to ${args.to}: ${JSON.stringify(error)}`)
        return false
      }
      return true
    } catch (err) {
      this.logger.error(`Mail send failed for ${args.to}`, err as Error)
      return false
    }
  }

  // ── Templates ────────────────────────────────────────────────────────────

  async sendWelcomeEmail(args: { to: string; firstName: string; tenantName: string; verifyToken: string }) {
    const verifyUrl = `${this.webUrl}/verificar-email/${args.verifyToken}`
    const subject = `¡Bienvenido a turnIT, ${args.tenantName}!`
    const html = layout(`
      <h1 style="margin:0 0 16px;font-size:22px;">¡Hola ${escape(args.firstName)}!</h1>
      <p>Tu negocio <strong>${escape(args.tenantName)}</strong> se registró en turnIT con éxito.</p>
      <p>Empezás con <strong>45 días de prueba gratis</strong>. Después podés activar tu suscripción desde el dashboard.</p>
      <p>Confirmá tu email para que podamos avisarte de turnos y novedades:</p>
      ${button(verifyUrl, 'Confirmar email')}
      <p style="color:#666;font-size:13px;">Si no fuiste vos quien se registró, ignorá este mail.</p>
    `)
    return this.send({ to: args.to, subject, html })
  }

  async sendOtpCode(args: { to: string; code: string; tenantName: string }) {
    const subject = `${args.code} — Tu código de verificación`
    const html = layout(`
      <h1 style="margin:0 0 16px;font-size:22px;">Código de verificación</h1>
      <p>Usá este código para continuar con tu reserva en <strong>${escape(args.tenantName)}</strong>:</p>
      <div style="margin:24px 0;text-align:center;">
        <span style="display:inline-block;background:#f3f4f6;border:2px solid #e5e7eb;border-radius:12px;padding:16px 32px;font-size:32px;font-weight:700;letter-spacing:8px;color:#111;">${args.code}</span>
      </div>
      <p style="color:#666;font-size:13px;">El código vence en 10 minutos. Si no solicitaste este código, ignorá este email.</p>
    `)
    return this.send({ to: args.to, subject, html })
  }

  async sendPasswordResetEmail(args: { to: string; firstName: string; resetToken: string }) {
    const resetUrl = `${this.webUrl}/restablecer-password/${args.resetToken}`
    const subject = 'Restablecé tu contraseña en turnIT'
    const html = layout(`
      <h1 style="margin:0 0 16px;font-size:22px;">Hola ${escape(args.firstName)}</h1>
      <p>Recibimos un pedido para restablecer tu contraseña en turnIT.</p>
      <p>Hacé click en el botón de abajo. El link vence en <strong>1 hora</strong>.</p>
      ${button(resetUrl, 'Restablecer contraseña')}
      <p style="color:#666;font-size:13px;">Si no pediste este cambio, ignorá este mail — tu contraseña actual sigue funcionando.</p>
    `)
    return this.send({ to: args.to, subject, html })
  }
}

// ── HTML helpers ──────────────────────────────────────────────────────────

function escape(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]!))
}

function button(href: string, label: string): string {
  return `<p style="margin:24px 0;">
    <a href="${href}" style="background:#16a34a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">${escape(label)}</a>
  </p>
  <p style="font-size:13px;color:#666;">O copiá este link en tu navegador:<br><span style="color:#16a34a;word-break:break-all;">${href}</span></p>`
}

function layout(content: string): string {
  return `<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#f3f4f6;margin:0;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;color:#111;">
    <div style="font-weight:700;font-size:18px;color:#16a34a;margin-bottom:24px;">turnIT</div>
    ${content}
    <hr style="border:none;border-top:1px solid #eee;margin:32px 0 16px;">
    <p style="font-size:12px;color:#999;margin:0;">turnIT — sistema de turnos online</p>
  </div>
</body></html>`
}
