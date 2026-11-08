/**
 * Payload que OpenWA entrega en el webhook `message.received`:
 *
 * {
 *   "event": "message.received",
 *   "timestamp": "2026-02-02T10:00:00.000Z",
 *   "sessionId": "f635f2e6-...",
 *   "idempotencyKey": "msg_...",
 *   "deliveryId": "dlv_...",
 *   "data": { "id": "...", "chatId": "949309464@c.us", "from": "...",
 *             "body": "hola", "type": "text", "timestamp": 1705312200 }
 * }
 *
 * Los campos del mensaje se aceptan también en la raíz para poder probar el
 * webhook con un body plano.
 */
export interface OpenwaWebhookPayload {
  event?: string;
  sessionId?: string;
  timestamp?: string | number;
  idempotencyKey?: string;
  deliveryId?: string;
  /** Objeto del mensaje cuando llega el envelope completo de OpenWA. */
  data?: OpenwaMessage;
  /** Campos del mensaje aplanados en la raíz (cuerpo "plano"). */
  id?: string;
  chatId?: string;
  from?: string;
  body?: string;
  type?: string;
  fromMe?: boolean;
  isGroup?: boolean;
}

export interface OpenwaMessage {
  id?: string;
  chatId?: string;
  from?: string;
  body?: string;
  type?: string;
  timestamp?: number;
  fromMe?: boolean;
  isGroup?: boolean;
}
