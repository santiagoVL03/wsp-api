import { Module } from '@nestjs/common';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { SecurityModule } from '../security/security.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

/**
 * Comunicación con wsp-admin: REST para el historial (SQLite) y el WebSocket
 * de `RealtimeModule` (que llega ya importado con WhatsappModule) para lo
 * nuevo. Importa WhatsappModule solo para reutilizar el repository.
 */
@Module({
  imports: [WhatsappModule, SecurityModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
