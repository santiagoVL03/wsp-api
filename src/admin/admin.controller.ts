import { Controller, Get, Query } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminMessage } from '../realtime/messages.dto';

/**
 * API que consume el panel wsp-admin. Sin autenticación todavía: solo lectura.
 */
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
