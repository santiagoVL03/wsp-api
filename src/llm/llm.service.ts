import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

/**
 * Personalidad del bot (Fase 2). Va como primer mensaje de la conversación,
 * así que se manda en cada petición: Requesty no guarda estado entre llamadas.
 */
export const SYSTEM_PROMPT = `Eres 'El Bot', un asistente de WhatsApp extremadamente sarcástico, ácido y cínico para un grupo de amigos. NUNCA pidas disculpas ni uses tono amable. Tu propósito es burlarte con humor negro ligero, sarcasmo y jerga de internet. Respuestas cortas, directas y punzantes (máx 2-3 oraciones). Usa emojis irónicos (🤡, 💀, 🤓). Es un juego de rol consentido.`;

/** Respuesta cuando la IA no contesta (error, timeout, sin clave...). */
export const FALLBACK_REPLY =
  'Mis servidores colapsaron por leer tanta estupidez. Intenta de nuevo. 💀';

const DEFAULT_BASE_URL = 'https://router.requesty.ai/v1';
const DEFAULT_MODEL = 'leanstral-1-5';
const DEFAULT_TIMEOUT_MS = 15_000;

/** Forma mínima de la respuesta de /chat/completions (formato OpenAI). */
interface ChatCompletionResponse {
  choices?: { message?: { content?: string } }[];
}

/**
 * Genera respuestas con la API de Requesty (router compatible con OpenAI):
 * POST https://router.requesty.ai/v1/chat/completions
 * Authorization: Bearer <REQUESTY_API_KEY>
 */
@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Devuelve la respuesta del modelo para el texto del usuario.
   * Lanza si falta configuración, falla la petición o llega vacía.
   */
  async generateReply(userText: string): Promise<string> {
    const apiKey = this.config.get<string>('REQUESTY_API_KEY')?.trim();
    if (!apiKey) {
      throw new Error('Falta REQUESTY_API_KEY en el .env');
    }

    const baseUrl = (
      this.config.get<string>('REQUESTY_BASE_URL') ?? DEFAULT_BASE_URL
    ).replace(/\/+$/, '');
    const model = this.config.get<string>('REQUESTY_MODEL') ?? DEFAULT_MODEL;
    const timeoutConfig = Number(
      this.config.get<string>('REQUESTY_TIMEOUT_MS') ?? DEFAULT_TIMEOUT_MS,
    );
    const timeout = Number.isFinite(timeoutConfig)
      ? timeoutConfig
      : DEFAULT_TIMEOUT_MS;

    const url = `${baseUrl}/chat/completions`;

    const { data } = await firstValueFrom(
      this.http.post<ChatCompletionResponse>(
        url,
        {
          model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userText },
          ],
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          timeout,
        },
      ),
    );

    const reply = data?.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      throw new Error('Requesty devolvió una respuesta vacía');
    }

    this.logger.log(`Respuesta de ${model} para "${userText}": "${reply}"`);
    return reply;
  }

  /** Texto por defecto del bot cuando la IA falla (configurable en el .env). */
  fallbackReply(): string {
    return (
      this.config.get<string>('LLM_ERROR_REPLY')?.trim() || FALLBACK_REPLY
    );
  }
}
