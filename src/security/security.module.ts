import { Module } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';
import { RateLimitGuard } from './rate-limit.guard';
import { WebhookSignatureGuard } from './webhook-signature.guard';

/**
 * Guards compartidos por el panel y el webhook. Los módulos que los usan con
 * `@UseGuards` importan este, así Nest resuelve sus dependencias (ConfigService).
 */
@Module({
  providers: [ApiKeyGuard, RateLimitGuard, WebhookSignatureGuard],
  exports: [ApiKeyGuard, RateLimitGuard, WebhookSignatureGuard],
})
export class SecurityModule {}
