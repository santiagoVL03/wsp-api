import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  RawBodyRequest,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { createHmac } from 'node:crypto';
import { safeEqual } from './safe-equal';

/**
 * Verifica que la entrega venga de OpenWA:
 *
 * - `X-OpenWA-Signature: sha256=<hex>` → HMAC-SHA256 del cuerpo exacto
 *   (OpenWA lo firma cuando el webhook tiene `secret`).
 * - `X-Webhook-Token: <secreto>` → atajo para probar el flujo a mano con curl
 *   sin tener que calcular la firma.
 *
 * Se apoya en `rawBody` (activado en main.ts): el hash se calcula sobre los
 * bytes recibidos, no sobre el JSON re-serializado.
 */
@Injectable()
export class WebhookSignatureGuard implements CanActivate {
  private readonly logger = new Logger(WebhookSignatureGuard.name);

  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const secret = this.config.get<string>('OPENWA_WEBHOOK_SECRET')?.trim();

    if (!secret) {
      // main.ts impide arrancar así en producción: esto solo pasa en local.
      this.logger.warn(
        'OPENWA_WEBHOOK_SECRET sin configurar: webhook sin verificar (solo desarrollo)',
      );
      return true;
    }

    const request = context.switchToHttp().getRequest<RawBodyRequest<Request>>();
    const signature = this.header(request, 'x-openwa-signature');
    const rawBody = request.rawBody;

    if (rawBody && signature && this.matches(rawBody, signature, secret)) {
      return true;
    }

    const token = this.header(request, 'x-webhook-token');
    if (token && safeEqual(token, secret)) {
      return true;
    }

    this.logger.warn(`Webhook rechazado desde ${request.ip ?? 'IP desconocida'}`);
    throw new UnauthorizedException('Firma del webhook inválida');
  }

  private matches(rawBody: Buffer, signature: string, secret: string): boolean {
    const expected = `sha256=${createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex')}`;

    return safeEqual(signature.trim(), expected);
  }

  private header(request: Request, name: string): string | null {
    const value = request.headers[name];

    if (Array.isArray(value)) {
      return value[0] ?? null;
    }

    return value ?? null;
  }
}
