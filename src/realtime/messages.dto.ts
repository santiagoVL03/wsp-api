import { IncomingMessage } from '../whatsapp/entities/incoming-message.entity';

/**
 * Contrato que consume wsp-admin, tanto por REST (`GET /api/messages`) como
 * por WebSocket. Es plano y con fechas en ISO para que el frontend lo itere
 * sin tocar TypeORM.
 */
export interface AdminMessage {
  id: string;
  receivedAt: string;
  chatId: string | null;
  /** Lo que escribió el usuario por WhatsApp. */
  message: string | null;
  /** Lo que contestó el bot (IA o fallback), null mientras no haya respuesta. */
  reply: string | null;
}

export function toAdminMessage(row: IncomingMessage): AdminMessage {
  return {
    id: row.id,
    receivedAt: new Date(row.receivedAt).toISOString(),
    chatId: row.chatId,
    message: row.body,
    reply: row.reply ?? null,
  };
}
