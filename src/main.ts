import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { allowedOrigins } from './security/origins';

/**
 * En producción el proceso no arranca sin las claves: es preferible caerse a
 * quedar expuesto a internet sin autenticación.
 */
function assertProductionSecrets(config: ConfigService): void {
  if (config.get<string>('NODE_ENV') !== 'production') {
    return;
  }

  const missing = ['ADMIN_API_KEY', 'OPENWA_WEBHOOK_SECRET'].filter(
    (key) => !config.get<string>(key)?.trim(),
  );

  if (missing.length > 0) {
    throw new Error(
      `Faltan variables obligatorias en producción: ${missing.join(', ')}`,
    );
  }
}

async function bootstrap(): Promise<void> {
  // rawBody: la firma del webhook se calcula sobre los bytes exactos recibidos.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const config = app.get(ConfigService);

  // Detrás de Caddy: sin esto el rate limit vería la IP del proxy, no la real.
  if (config.get<string>('TRUST_PROXY') !== 'false') {
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
  }

  // Solo el panel puede leer desde un navegador: el resto de orígenes no.
  app.enableCors({
    origin: allowedOrigins(config.get<string>('CORS_ORIGINS')),
    methods: ['GET'],
    allowedHeaders: ['Content-Type', 'X-API-Key', 'Authorization'],
  });

  // Cabeceras que no dependen del proxy (Caddy añade HSTS).
  app.use((_request: Request, response: Response, next: NextFunction) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });

  assertProductionSecrets(config);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  new Logger('Bootstrap').log(`wsp-api escuchando en el puerto ${port}`);
}

void bootstrap().catch((error: unknown) => {
  new Logger('Bootstrap').error(error);
  process.exit(1);
});
