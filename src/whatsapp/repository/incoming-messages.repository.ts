import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IncomingMessage } from '../entities/incoming-message.entity';
import { OpenwaWebhookPayload } from '../openwa-webhook.types';

/**
 * Capa de acceso a datos: es la única que habla con SQLite.
 * El servicio de WhatsApp no conoce columnas ni queries.
 */
@Injectable()
export class IncomingMessagesRepository {
  private readonly logger = new Logger(IncomingMessagesRepository.name);

  constructor(
    @InjectRepository(IncomingMessage)
    private readonly repository: Repository<IncomingMessage>,
  ) {}

  /** Guarda el mensaje recibido en el webhook y devuelve la fila creada. */
  saveFromWebhook(payload: OpenwaWebhookPayload): Promise<IncomingMessage> {
    // Los campos del mensaje pueden venir en `data` o aplanados en la raíz.
    const message = payload.data ?? payload;

    return this.repository.save(
      this.repository.create({
        event: payload.event ?? null,
        sessionId: payload.sessionId ?? null,
        chatId: message.chatId ?? null,
        body: message.body ?? null,
        messageType: message.type ?? null,
        fromMe: message.fromMe ?? false,
        raw: payload,
      }),
    );
  }

  /** Mensajes más recientes primero. */
  findRecent(limit = 50): Promise<IncomingMessage[]> {
    return this.repository.find({
      order: { receivedAt: 'DESC' },
      take: limit,
    });
  }

  /** Mensajes de un chat concreto, más recientes primero. */
  findByChatId(chatId: string, limit = 50): Promise<IncomingMessage[]> {
    return this.repository.find({
      where: { chatId },
      order: { receivedAt: 'DESC' },
      take: limit,
    });
  }

  /** Anota en la fila la respuesta que se envió al chat. */
  async saveReply(
    id: string,
    reply: string,
  ): Promise<IncomingMessage | null> {
    await this.repository.update({ id }, { reply });
    return this.findById(id);
  }

  findById(id: string): Promise<IncomingMessage | null> {
    return this.repository.findOne({ where: { id } });
  }

  /** Modifica un mensaje guardado (por ejemplo para anotar el resultado). */
  async update(
    id: string,
    changes: Partial<Pick<IncomingMessage, 'body' | 'messageType' | 'fromMe'>>,
  ): Promise<IncomingMessage | null> {
    await this.repository.update({ id }, changes);
    return this.findById(id);
  }

  count(): Promise<number> {
    return this.repository.count();
  }

  async deleteById(id: string): Promise<boolean> {
    const result = await this.repository.delete({ id });
    const deleted = result.affected ?? 0;
    if (deleted === 0) {
      this.logger.warn(`No existe el mensaje ${id}`);
    }
    return deleted > 0;
  }
}
