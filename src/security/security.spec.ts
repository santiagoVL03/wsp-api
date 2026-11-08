import { HttpException, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { ExecutionContext } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { ApiKeyGuard } from './api-key.guard';
import { RateLimitGuard } from './rate-limit.guard';
import { WebhookSignatureGuard } from './webhook-signature.guard';

/** ConfigService mínimo: los guards solo leen variables con `get`. */
function config(values: Record<string, string | undefined>): ConfigService {
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

/** ExecutionContext mínimo: los guards solo piden la request HTTP. */
function context(request: object): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('ApiKeyGuard', () => {
  const guard = new ApiKeyGuard(config({ ADMIN_API_KEY: 'secreta' }));

  it('deja pasar con la clave correcta en X-API-Key', () => {
    const request = { headers: { 'x-api-key': 'secreta' } };

    expect(guard.canActivate(context(request))).toBe(true);
  });

  it('acepta Authorization: Bearer', () => {
    const request = { headers: { authorization: 'Bearer secreta' } };

    expect(guard.canActivate(context(request))).toBe(true);
  });

  it('rechaza una clave distinta', () => {
    const request = { headers: { 'x-api-key': 'otra' } };

    expect(() => guard.canActivate(context(request))).toThrow(
      UnauthorizedException,
    );
  });

  it('rechaza cuando no se manda ninguna clave', () => {
    expect(() => guard.canActivate(context({ headers: {} }))).toThrow(
      UnauthorizedException,
    );
  });

  it('sin clave configurada deja pasar (main.ts lo impide en producción)', () => {
    const dev = new ApiKeyGuard(config({}));

    expect(dev.canActivate(context({ headers: {} }))).toBe(true);
  });
});

describe('WebhookSignatureGuard', () => {
  const secret = 'secreto-de-pruebas';
  const rawBody = Buffer.from('{"event":"message.received"}');
  const guard = new WebhookSignatureGuard(
    config({ OPENWA_WEBHOOK_SECRET: secret }),
  );

  it('acepta la firma HMAC de OpenWA', () => {
    const signature = `sha256=${createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex')}`;

    expect(
      guard.canActivate(
        context({ headers: { 'x-openwa-signature': signature }, rawBody }),
      ),
    ).toBe(true);
  });

  it('rechaza una firma inválida', () => {
    const request = { headers: { 'x-openwa-signature': 'sha256=00' }, rawBody };

    expect(() => guard.canActivate(context(request))).toThrow(
      UnauthorizedException,
    );
  });

  it('rechaza el cuerpo alterado aunque traiga una firma', () => {
    const signature = `sha256=${createHmac('sha256', secret)
      .update(Buffer.from('{"event":"message.sent"}'))
      .digest('hex')}`;
    const request = {
      headers: { 'x-openwa-signature': signature },
      rawBody,
    };

    expect(() => guard.canActivate(context(request))).toThrow(
      UnauthorizedException,
    );
  });

  it('acepta el token compartido para las pruebas con curl', () => {
    expect(
      guard.canActivate(context({ headers: { 'x-webhook-token': secret } })),
    ).toBe(true);
  });
});

describe('RateLimitGuard', () => {
  it('corta al pasar del límite por minuto', () => {
    const guard = new RateLimitGuard(
      config({ API_RATE_LIMIT_PER_MINUTE: '2' }),
    );
    const ctx = context({ ip: '10.0.0.1' });

    expect(guard.canActivate(ctx)).toBe(true);
    expect(guard.canActivate(ctx)).toBe(true);
    expect(() => guard.canActivate(ctx)).toThrow(HttpException);
  });

  it('se desactiva con 0', () => {
    const guard = new RateLimitGuard(
      config({ API_RATE_LIMIT_PER_MINUTE: '0' }),
    );
    const ctx = context({ ip: '10.0.0.2' });

    expect(guard.canActivate(ctx)).toBe(true);
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
