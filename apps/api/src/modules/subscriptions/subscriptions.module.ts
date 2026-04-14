import { Module } from '@nestjs/common'
import { SubscriptionsService } from './subscriptions.service'
import { SubscriptionsController } from './subscriptions.controller'
import { WebhooksController } from './webhooks.controller'
import { MercadoPagoService } from './mercadopago.service'

@Module({
  providers:   [SubscriptionsService, MercadoPagoService],
  controllers: [SubscriptionsController, WebhooksController],
  exports:     [SubscriptionsService],
})
export class SubscriptionsModule {}
