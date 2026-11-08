import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { safeEqual } from './safe-equal';

/**
 * Protege la API del panel (`/api/*`) con `ADMIN_API_KEY`.
 * Acepta `X-API-Key: <clave>` o `Authorization: Bearer <clave>`.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('ADMIN_API_KEY')?.trim();

    if (!expected) {
      // main.ts impide arrancar así en producción: esto solo pasa en local.
      this.logger.warn(
        'ADMIN_API_KEY sin configurar: la API del panel queda abierta (solo desarrollo)',
      );
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const provided = this.readKey(request);

    if (provided && safeEqual(provided, expected)) {
      return true;
    }

    this.logger.warn(
      `401 en ${request.method} ${request.originalUrl} desde ${request.ip ?? 'IP desconocida'}`,
    );
    throw new UnauthorizedException('Falta la API key o no es válida');
  }

  private readKey(request: Request): string | null {
    const header = request.headers['x-api-key'];
    const apiKey = Array.isArray(header) ? header[0] : header;
    if (apiKey?.trim()) {
      return apiKey.trim();
    }

    const authorization = request.headers.authorization;
    if (authorization?.startsWith('Bearer ')) {
      return authorization.slice('Bearer '.length).trim() || null;
    }

    return null;
  }
}
