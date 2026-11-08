import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

/**
 * Envía mensajes a OpenWA. Reemplaza el cURL de referencia:
 *
 * curl --location 'http://localhost:2785/api/sessions/<SESSION_ID>/messages/send-text' \
 *   --header 'Content-Type: application/json' \
 *   --header 'X-API-Key: <API_KEY>' \
 *   --data-raw '{"chatId":"949309464@c.us","text":"Hello from OpenWA!"}'
 */
@Injectable()
export class OpenwaService {
  private readonly logger = new Logger(OpenwaService.name);

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  async sendText(chatId: string, text: string): Promise<void> {
    const baseUrl = this.config.get<string>('OPENWA_URL');
    const sessionId = this.config.get<string>('OPENWA_SESSION_ID');
    const apiKey = this.config.get<string>('OPENWA_API_KEY');

    if (!baseUrl || !sessionId || !apiKey) {
      this.logger.error(
        'Faltan OPENWA_URL, OPENWA_SESSION_ID u OPENWA_API_KEY en el .env: no se puede responder',
      );
      return;
    }

    const url = `${baseUrl.replace(/\/+$/, '')}/api/sessions/${sessionId}/messages/send-text`;

    try {
      await firstValueFrom(
        this.http.post(
          url,
          { chatId, text },
          {
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': apiKey,
            },
          },
        ),
      );
      this.logger.log(`Respuesta enviada a ${chatId}: "${text}"`);
    } catch (error) {
      // Se registra y no se propaga: el webhook ya se aceptó, así OpenWA no
      // reintenta la entrega y el usuario no recibe la respuesta duplicada.
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(`No se pudo enviar el mensaje a ${chatId}: ${reason}`);
    }
  }
}
