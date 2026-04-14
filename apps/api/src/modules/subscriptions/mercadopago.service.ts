import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { MercadoPagoConfig, PreApproval, Payment } from 'mercadopago'
import { createHmac, timingSafeEqual } from 'crypto'

/**
 * Thin wrapper over the Mercado Pago Node SDK (v2.x). Centralises:
 *  - SDK client lifecycle (token read from env once at boot)
 *  - webhook signature validation (HMAC-SHA256 as documented at
 *    https://www.mercadopago.com.ar/developers/en/docs/your-integrations/notifications/webhooks)
 *  - convenience helpers that return plain JSON so the service layer doesn't
 *    have to learn the MP SDK's response wrappers.
 *
 * Everything MP-specific lives here. The rest of the module talks to this.
 */
@Injectable()
export class MercadoPagoService implements OnModuleInit {
  private readonly logger = new Logger(MercadoPagoService.name)
  private client!: MercadoPagoConfig
  private preapproval!: PreApproval
  private payment!: Payment

  constructor(private config: ConfigService) {}

  onModuleInit() {
    const accessToken = this.config.get<string>('MP_ACCESS_TOKEN')
    if (!accessToken) {
      // Don't crash the whole API — subscriptions are an optional feature that
      // the rest of the product works without. We log loudly and let the
      // controllers fail with a clear 503 if someone hits them.
      this.logger.warn('MP_ACCESS_TOKEN not set — Mercado Pago integration disabled')
      return
    }
    this.client      = new MercadoPagoConfig({ accessToken })
    this.preapproval = new PreApproval(this.client)
    this.payment     = new Payment(this.client)
    this.logger.log('Mercado Pago client initialised')
  }

  isEnabled(): boolean {
    return !!this.client
  }

  private assertReady() {
    if (!this.isEnabled()) {
      throw new Error('Mercado Pago integration is not configured (MP_ACCESS_TOKEN missing)')
    }
  }

  /**
   * Create a subscription (preapproval) in `pending` state so MP returns an
   * `init_point` URL that the payer is redirected to to authorise the card.
   *
   * We send `auto_recurring` inline (not `preapproval_plan_id`): MP rejects
   * `preapproval_plan_id` with "card_token_id is required" when no tokenised
   * card is attached, which is our case — we want the hosted checkout to
   * collect the card itself.
   *
   * `external_reference` is set to our tenantId so webhook events can be
   * correlated back without a DB round-trip by payer email. `back_url` MUST
   * be an absolute HTTPS URL on a public domain — MP rejects http/localhost.
   */
  async createPreapproval(args: {
    payerEmail:         string
    backUrl:            string
    tenantId:           string
    amount:             number
    currency?:          string
    frequency?:         number
    frequencyType?:     'months' | 'days'
    reason?:            string
  }) {
    this.assertReady()
    const body = {
      payer_email:        args.payerEmail,
      back_url:           args.backUrl,
      external_reference: args.tenantId,
      reason:             args.reason,
      status:             'pending',
      auto_recurring: {
        frequency:          args.frequency     ?? 1,
        frequency_type:     args.frequencyType ?? 'months',
        transaction_amount: args.amount,
        currency_id:        args.currency      ?? 'ARS',
      },
    }
    return this.preapproval.create({ body })
  }

  async getPreapproval(id: string) {
    this.assertReady()
    return this.preapproval.get({ id })
  }

  async cancelPreapproval(id: string) {
    this.assertReady()
    return this.preapproval.update({ id, body: { status: 'cancelled' } })
  }

  async getPayment(id: string) {
    this.assertReady()
    return this.payment.get({ id: Number(id) })
  }

  /**
   * Validate the `x-signature` header MP sends with every webhook. Without
   * this check anyone who guesses the endpoint URL can forge payment events
   * and get tenants reactivated for free.
   *
   * Header format (two comma-separated key=value pairs):
   *   x-signature: ts=1704905177,v1=HMAC_HEX
   *   x-request-id: uuid
   *
   * Manifest to sign: `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
   * Algorithm: HMAC-SHA256 with the webhook secret from MP dashboard.
   */
  verifyWebhookSignature(args: {
    signatureHeader: string | undefined
    requestId:       string | undefined
    dataId:          string
  }): boolean {
    const secret = this.config.get<string>('MP_WEBHOOK_SECRET')
    if (!secret) {
      // No secret configured = we cannot verify. Refuse the webhook rather
      // than silently accepting unsigned calls.
      this.logger.error('MP_WEBHOOK_SECRET not set — rejecting webhook')
      return false
    }
    if (!args.signatureHeader || !args.requestId) return false

    const parts = Object.fromEntries(
      args.signatureHeader.split(',').map(p => {
        const [k, v] = p.split('=').map(s => s.trim())
        return [k, v] as const
      }),
    )
    const ts = parts.ts
    const v1 = parts.v1
    if (!ts || !v1) return false

    const manifest = `id:${args.dataId};request-id:${args.requestId};ts:${ts};`
    const expected = createHmac('sha256', secret).update(manifest).digest('hex')

    // Buffers must be same length for timingSafeEqual; bail early otherwise.
    if (expected.length !== v1.length) return false
    try {
      return timingSafeEqual(Buffer.from(expected), Buffer.from(v1))
    } catch {
      return false
    }
  }
}
