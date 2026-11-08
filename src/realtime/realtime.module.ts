import { Module } from '@nestjs/common';
import { MessagesGateway } from './messages.gateway';

/**
 * Canal en tiempo real hacia wsp-admin. No toca la base de datos: solo
 * publica los eventos que le pasa WhatsappService.
 */
@Module({
  providers: [MessagesGateway],
  exports: [MessagesGateway],
})
export class RealtimeModule {}
