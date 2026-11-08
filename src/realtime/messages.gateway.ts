import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AdminMessage } from './messages.dto';

/**
 * WebSocket del panel de administración (Socket.IO).
 *
 * Solo empuja eventos: el historial lo pide wsp-admin por REST
 * (`GET /api/messages`) y aquí se entera de lo nuevo en tiempo real.
 *
 * Eventos que emite:
 * - `message:new`     → mensaje recibido (todavía sin respuesta)
 * - `message:updated` → el mismo mensaje con la respuesta del bot ya guardada
 */
@WebSocketGateway({ cors: { origin: true } })
export class MessagesGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(MessagesGateway.name);

  @WebSocketServer()
  server?: Server;

  handleConnection(client: Socket): void {
    this.logger.log(`Panel conectado (${client.id})`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Panel desconectado (${client.id})`);
  }

  /** Hay un mensaje nuevo: se muestra al instante en el panel. */
  emitNew(message: AdminMessage): void {
    this.emit('message:new', message);
  }

  /** La IA respondió (o falló y se mandó el fallback): se rellena la columna. */
  emitUpdated(message: AdminMessage): void {
    this.emit('message:updated', message);
  }

  private emit(event: string, message: AdminMessage): void {
    // Puede no haber ningún panel escuchando: el bot no depende de esto.
    if (!this.server) {
      this.logger.warn(`WebSocket sin arrancar, descarto "${event}"`);
      return;
    }

    this.server.emit(event, message);
  }
}
