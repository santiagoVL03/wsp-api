import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import type { OpenwaWebhookPayload } from './openwa-webhook.types';
import { WhatsappService } from './whatsapp.service';

@Controller('webhook')
export class WhatsappController {
  constructor(private readonly whatsapp: WhatsappService) {}

  /** POST /webhook/openwa — destinatario de los eventos de OpenWA. */
  @Post('openwa')
  @HttpCode(200)
  async receive(
    @Body() payload: OpenwaWebhookPayload,
  ): Promise<{ received: true }> {
    await this.whatsapp.handleWebhook(payload);
    return { received: true };
  }
}
