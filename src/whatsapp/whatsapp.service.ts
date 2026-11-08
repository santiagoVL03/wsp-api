import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmService } from '../llm/llm.service';
import { toAdminMessage } from '../realtime/messages.dto';
import { MessagesGateway } from '../realtime/messages.gateway';
import { IncomingMessage } from './entities/incoming-message.entity';
import { OpenwaWebhookPayload } from './openwa-webhook.types';
import { OpenwaService } from './openwa.service';
import { IncomingMessagesRepository } from './repository/incoming-messages.repository';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    private readonly openwa: OpenwaService,
    private readonly config: ConfigService,
    private readonly messages: IncomingMessagesRepository,
    private readonly llm: LlmService,
    private readonly gateway: MessagesGateway,
  ) {}

  async handleWebhook(payload: OpenwaWebhookPayload): Promise<void> {
    // Solo mensajes entrantes: el resto de eventos de OpenWA se ignoran.
    if (payload.event && payload.event !== 'message.received') {
      return;
    }

    const message = payload.data ?? payload;
    const chatId = message.chatId;
    const body = message.body;

    if (!chatId || !body || message.fromMe) {
      return;
    }

    const prompt = this.extractPrompt(body);
    if (!prompt) {
      return;
    }

    // Se guarda y se avisa al panel antes de llamar a la IA: el mensaje
    // aparece en wsp-admin aunque el modelo tarde o falle.
    const saved = await this.saveOriginalMessage(payload);
    if (saved) {
      this.gateway.emitNew(toAdminMessage(saved));
    }

    let reply: string;
    try {
      // Fase 2: la respuesta la genera el modelo, no el texto fijo de la Fase 1.
      reply = await this.llm.generateReply(prompt);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(`La IA no respondió (${reason}); mando el fallback`);
      reply = this.llm.fallbackReply();
    }

    // Se anota y se publica antes de enviarlo: el panel muestra la respuesta
    // en cuanto existe, sin esperar a que OpenWA termine de mandarla.
    await this.saveReply(saved, reply);
    await this.openwa.sendText(chatId, reply);
  }

  /**
   * Devuelve el texto del usuario cuando el mensaje menciona al bot, o null si
   * no hay mención. La mención se quita del texto que se le pasa al modelo.
   */
  private extractPrompt(body: string): string | null {
    const text = body.trim();

    const botTrigger = (
      this.config.get<string>('BOT_PRUEBAS_K6_TRIGGER') ?? ''
    ).trim();
    const pseudoTrigger = (
      this.config.get<string>('PSEUDONIMO_TRIGGER') ?? ''
    ).trim();

    if (!botTrigger || !pseudoTrigger) {
      this.logger.error(
        'Faltan BOT_PRUEBAS_K6_TRIGGER o PSEUDONIMO_TRIGGER en el .env: no se responde',
      );
      return null;
    }

    // El primero exige coincidencia exacta (se permite espacio alrededor);
    // el pseudónimo puede venir dentro de una frase: "@Sn hola".
    const matched = text === botTrigger ? botTrigger : text.includes(pseudoTrigger) ? pseudoTrigger : null;
    if (!matched) {
      return null;
    }

    const withoutMention = text
      .split(matched)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Si solo fue la mención, el modelo recibe el texto tal cual: responderá
    // al hecho de que lo mencionaron sin decir nada.
    return withoutMention || text;
  }

  /** Guarda el mensaje original recibido en SQLite (vía la capa repository). */
  private async saveOriginalMessage(
    payload: OpenwaWebhookPayload,
  ): Promise<IncomingMessage | null> {
    // Solo metadatos: el contenido de los chats no se escribe en los logs.
    const message = payload.data ?? payload;
    this.logger.log(
      `Mensaje original de ${message.chatId ?? 'chat desconocido'} ` +
        `(id ${message.id ?? 'sin id'}, ${message.type ?? 'sin tipo'})`,
    );

    try {
      const saved = await this.messages.saveFromWebhook(payload);
      this.logger.log(`Mensaje guardado en SQLite con id ${saved.id}`);
      return saved;
    } catch (error) {
      // Guardar es auxiliar: si falla, la respuesta al chat se envía igual.
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(`No se pudo guardar el mensaje original: ${reason}`);
      return null;
    }
  }

  /** Anota la respuesta enviada y la publica para que el panel la muestre. */
  private async saveReply(
    saved: IncomingMessage | null,
    reply: string,
  ): Promise<void> {
    if (!saved) {
      return;
    }

    try {
      const updated = await this.messages.saveReply(saved.id, reply);
      if (updated) {
        this.gateway.emitUpdated(toAdminMessage(updated));
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(`No se pudo guardar la respuesta: ${reason}`);
    }
  }
}
