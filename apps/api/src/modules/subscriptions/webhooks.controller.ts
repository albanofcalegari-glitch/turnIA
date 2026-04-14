import { Controller, Post, Body, Headers, HttpCode, HttpStatus, Logger, UnauthorizedException } from '@nestjs/common'
import { SubscriptionsService } from './subscriptions.service'
import { MercadoPagoService } from './mercadopago.service'

/**
 * Public webhook receiver for Mercado Pago. MP retries on non-2xx, so we try
 * hard to always respond 200 — failures are logged and surfaced via the
 * admin view, not via retry storms.
 *
 * This path must be:
 *  - publicly reachable (no JWT guard, no tenant middleware)
 *  - signature-validated (HMAC against MP_WEBHOOK_SECRET)
 */
@Controller('webhooks/mercadopago')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name)

  constructor(
    private subscriptions: SubscriptionsService,
    private mp: MercadoPagoService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async handle(
    @Headers('x-signature')  signature:  string | undefined,
    @Headers('x-request-id') requestId:  string | undefined,
    @Body() body: any,
  ) {
    const dataId = body?.data?.id ? String(body.data.id) : undefined
    const type   = body?.type ?? body?.topic
    this.logger.log(`Webhook received: type=${type} dataId=${dataId}`)

    if (!dataId) {
      // Some MP pings have no data.id (eg. "test" events). Ack and drop.
      return { received: true }
    }

    const valid = this.mp.verifyWebhookSignature({
      signatureHeader: signature,
      requestId,
      dataId,
    })
    if (!valid) {
      this.logger.warn('Webhook signature invalid — rejecting')
      throw new UnauthorizedException('Invalid signature')
    }

    try {
      if (type === 'payment') {
        await this.subscriptions.handlePaymentWebhook(dataId)
      } else if (type === 'subscription_preapproval' || type === 'preapproval') {
        await this.subscriptions.handlePreapprovalWebhook(dataId)
      } else if (type === 'subscription_authorized_payment') {
        // Recurring-charge events. The underlying `payment` event covers the
        // accounting side, so we just log here.
        this.logger.log(`authorized_payment event for ${dataId} (logged only)`)
      } else {
        this.logger.log(`Unhandled webhook type: ${type}`)
      }
    } catch (err) {
      // Swallow so MP stops retrying. The error is in our logs and the raw
      // payload will be replayable from MP's event history if needed.
      this.logger.error(`Webhook handler failed: ${(err as Error).message}`, (err as Error).stack)
    }

    return { received: true }
  }
}
