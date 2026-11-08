import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

/** Ventana fija de un minuto, en memoria: una sola instancia, sin Redis. */
const WINDOW_MS = 60_000;
/** Peticiones por minuto y por IP si `API_RATE_LIMIT_PER_MINUTE` no está. */
const DEFAULT_LIMIT = 120;
/** A partir de aquí se limpian las ventanas vencidas (evita crecer sin fin). */
const SWEEP_THRESHOLD = 1_000;

interface Window {
  count: number;
  resetAt: number;
}

/**
 * Límite básico por IP: frena scripts que intenten adivinar la API key o
 * inundar el webhook. `API_RATE_LIMIT_PER_MINUTE=0` lo desactiva.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly windows = new Map<string, Window>();

  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const limit = this.limit();
    if (limit <= 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const key = request.ip ?? request.socket.remoteAddress ?? 'desconocida';
    const now = Date.now();
    const window = this.windows.get(key);

    if (!window || window.resetAt <= now) {
      this.windows.set(key, { count: 1, resetAt: now + WINDOW_MS });
      this.sweep(now);
      return true;
    }

    window.count += 1;
    if (window.count > limit) {
      throw new HttpException(
        'Demasiadas peticiones, espera un minuto',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private limit(): number {
    const raw = Number(
      this.config.get<string>('API_RATE_LIMIT_PER_MINUTE') ?? DEFAULT_LIMIT,
    );

    return Number.isFinite(raw) ? raw : DEFAULT_LIMIT;
  }

  /** Olvida las IPs que ya no mandan nada. */
  private sweep(now: number): void {
    if (this.windows.size < SWEEP_THRESHOLD) {
      return;
    }

    for (const [key, window] of this.windows) {
      if (window.resetAt <= now) {
        this.windows.delete(key);
      }
    }
  }
}
