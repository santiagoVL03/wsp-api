import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IncomingMessagesRepository } from '../whatsapp/repository/incoming-messages.repository';
import { AdminMessage, toAdminMessage } from '../realtime/messages.dto';

/** Límite por defecto y máximo de filas que devuelve `GET /api/messages`. */
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

/**
 * Datos que consume wsp-admin. Lee de SQLite a través de la capa repository,
 * así que el panel y el bot ven exactamente las mismas filas.
 */
@Injectable()
export class AdminService {
  constructor(
    private readonly messages: IncomingMessagesRepository,
    private readonly config: ConfigService,
  ) {}

  /** Historial del más reciente al más antiguo. */
  async recent(limit?: number): Promise<AdminMessage[]> {
    const rows = await this.messages.findRecent(this.normalizeLimit(limit));
    return rows.map(toAdminMessage);
  }

  /** Sesión de OpenWA que el panel muestra en la tarjeta de estado. */
  status(): { sessionId: string | null } {
    return {
      sessionId: this.config.get<string>('OPENWA_SESSION_ID') ?? null,
    };
  }

  private normalizeLimit(limit?: number): number {
    if (limit === undefined || !Number.isFinite(limit)) {
      return DEFAULT_LIMIT;
    }

    return Math.min(Math.max(Math.trunc(limit), 1), MAX_LIMIT);
  }
}
