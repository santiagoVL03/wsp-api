import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { ApiKeyGuard } from '../security/api-key.guard';
import { RateLimitGuard } from '../security/rate-limit.guard';
import { AdminMessage } from '../realtime/messages.dto';

/**
 * API que consume el panel wsp-admin. Requiere `ADMIN_API_KEY` en
 * `X-API-Key` (o `Authorization: Bearer`) y va limitada por IP.
 */
@UseGuards(ApiKeyGuard, RateLimitGuard)
@Controller('api')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  /** GET /api/messages?limit=100 — historial, del más reciente al más antiguo. */
  @Get('messages')
  async messages(
    @Query('limit') limit?: string,
  ): Promise<{ messages: AdminMessage[] }> {
    return { messages: await this.admin.recent(Number(limit)) };
  }

  /** GET /api/status — sesión de OpenWA para la tarjeta del panel. */
  @Get('status')
  status(): { sessionId: string | null } {
    return this.admin.status();
  }
}
