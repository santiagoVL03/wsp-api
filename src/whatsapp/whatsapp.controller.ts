import {
  Body,
  Controller,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { OpenwaWebhookPayload } from './openwa-webhook.types';
import { RateLimitGuard } from '../security/rate-limit.guard';
import { WebhookSignatureGuard } from '../security/webhook-signature.guard';
import { WhatsappService } from './whatsapp.service';

/**
 * POST /webhook/openwa — destinatario de los eventos de OpenWA.
 * Solo acepta entregas firmadas por OpenWA (`X-OpenWA-Signature`).
 */
@UseGuards(WebhookSignatureGuard, RateLimitGuard)
@Controller('webhook')
export class WhatsappController {
  constructor(private readonly whatsapp: WhatsappService) {}

  @Post('openwa')
  @HttpCode(200)
  async receive(
    @Body() payload: OpenwaWebhookPayload,
  ): Promise<{ received: true }> {
    await this.whatsapp.handleWebhook(payload);
    return { received: true };
  }
}
