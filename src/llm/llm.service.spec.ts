import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { FALLBACK_REPLY, LlmService, SYSTEM_PROMPT } from './llm.service';

describe('LlmService', () => {
  let post: jest.Mock;
  let http: HttpService;

  const configFor = (values: Record<string, string>) =>
    ({
      get: jest.fn((key: string) => values[key]),
    }) as unknown as ConfigService;

  const withEnv = (extra: Record<string, string> = {}) =>
    new LlmService(
      http,
      configFor({ REQUESTY_API_KEY: 'rq-test-123', ...extra }),
    );

  beforeEach(() => {
    post = jest.fn().mockReturnValue(
      of({
        data: {
          choices: [{ message: { content: '  respuesta del modelo 💀  ' } }],
        },
      }),
    );
    http = { post } as unknown as HttpService;
  });

  it('llama al endpoint de Requesty con el modelo, el system prompt y la clave', async () => {
    const reply = await withEnv({ REQUESTY_MODEL: 'leanstral-1-5' }).generateReply(
      'hola bot',
    );

    expect(reply).toBe('respuesta del modelo 💀');
    expect(post).toHaveBeenCalledTimes(1);

    const [url, body, options] = post.mock.calls[0] as [
      string,
      {
        model: string;
        messages: { role: string; content: string }[];
      },
      { headers: Record<string, string>; timeout: number },
    ];

    expect(url).toBe('https://router.requesty.ai/v1/chat/completions');
    expect(body.model).toBe('leanstral-1-5');
    expect(body.messages).toEqual([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: 'hola bot' },
    ]);
    expect(options.headers.Authorization).toBe('Bearer rq-test-123');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(options.timeout).toBe(15_000);
  });

  it('respeta REQUESTY_BASE_URL y REQUESTY_TIMEOUT_MS del .env', async () => {
    await withEnv({
      REQUESTY_BASE_URL: 'https://mi-proxy.local/v1/',
      REQUESTY_TIMEOUT_MS: '2500',
    }).generateReply('hola');

    const [url, , options] = post.mock.calls[0] as [
      string,
      unknown,
      { timeout: number },
    ];
    expect(url).toBe('https://mi-proxy.local/v1/chat/completions');
    expect(options.timeout).toBe(2500);
  });

  it('falla si no hay REQUESTY_API_KEY', async () => {
    const service = new LlmService(http, configFor({}));

    await expect(service.generateReply('hola')).rejects.toThrow(
      'Falta REQUESTY_API_KEY',
    );
    expect(post).not.toHaveBeenCalled();
  });

  it('propaga los errores del proveedor (timeout, 5xx, etc.)', async () => {
    post.mockReturnValueOnce(
      throwError(() => new Error('timeout of 15000ms exceeded')),
    );

    await expect(withEnv().generateReply('hola')).rejects.toThrow(
      'timeout of 15000ms exceeded',
    );
  });

  it('falla si el modelo devuelve contenido vacío', async () => {
    post.mockReturnValueOnce(
      of({ data: { choices: [{ message: { content: '   ' } }] } }),
    );

    await expect(withEnv().generateReply('hola')).rejects.toThrow(
      'respuesta vacía',
    );
  });

  it('usa el fallback del .env o el texto por defecto', () => {
    expect(withEnv().fallbackReply()).toBe(FALLBACK_REPLY);
    expect(withEnv({ LLM_ERROR_REPLY: 'otro fallback' }).fallbackReply()).toBe(
      'otro fallback',
    );
  });
});
