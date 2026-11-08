import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { allowedOrigins } from '../security/origins';
import { safeEqual } from '../security/safe-equal';
import { AdminMessage } from './messages.dto';

/**
 * WebSocket del panel de administración (Socket.IO).
 *
 * Solo empuja eventos: el historial lo pide wsp-admin por REST
 * (`GET /api/messages`) y aquí se entera de lo nuevo en tiempo real.
 *
 * El panel manda la API key al conectar (`io(url, { auth: { token } })`).
 * Sin clave válida el socket se rechaza: los mensajes no se filtran a nadie.
 *
 * Eventos que emite:
 * - `message:new`     → mensaje recibido (todavía sin respuesta)
 * - `message:updated` → el mismo mensaje con la respuesta del bot ya guardada
 */
@WebSocketGateway({
  cors: {
    origin: allowedOrigins(process.env.CORS_ORIGINS),
    methods: ['GET', 'POST'],
  },
})
export class MessagesGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(MessagesGateway.name);

  @WebSocketServer()
  server?: Server;

  /** Autentica el handshake antes de aceptar el socket. */
  afterInit(server: Server): void {
    server.use((client: Socket, next: (error?: Error) => void) => {
      const expected = process.env.ADMIN_API_KEY?.trim();

      if (!expected) {
        // main.ts impide arrancar así en producción: esto solo pasa en local.
        next();
        return;
      }

      const token = this.tokenOf(client);
      if (token && safeEqual(token, expected)) {
        next();
        return;
      }

      this.logger.warn(`WebSocket rechazado (${client.handshake.address})`);
      next(new Error('API key inválida'));
    });
  }

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

  /** La clave llega en `auth.token` o, si no, en la cabecera del handshake. */
  private tokenOf(client: Socket): string | null {
    const auth = client.handshake.auth as { token?: unknown } | undefined;
    if (typeof auth?.token === 'string' && auth.token.trim()) {
      return auth.token.trim();
    }

    const header = client.handshake.headers['x-api-key'];
    return Array.isArray(header) ? header[0] ?? null : header ?? null;
  }
}
