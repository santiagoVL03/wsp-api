import { ConfigService } from '@nestjs/config';
import { IncomingMessage } from '../whatsapp/entities/incoming-message.entity';
import { IncomingMessagesRepository } from '../whatsapp/repository/incoming-messages.repository';
import { AdminService } from './admin.service';

describe('AdminService', () => {
  let findRecent: jest.Mock;
  let service: AdminService;

  const row = (over: Partial<IncomingMessage> = {}): IncomingMessage =>
    ({
      id: 'msg-1',
      receivedAt: new Date('2026-02-02T10:00:00.000Z'),
      chatId: '949309464@c.us',
      body: 'oye @Sn hola',
      reply: 'hola, humano 🤡',
      ...over,
    }) as IncomingMessage;

  const configFor = (values: Record<string, string>) =>
    ({
      get: jest.fn((key: string) => values[key]),
    }) as unknown as ConfigService;

  beforeEach(() => {
    findRecent = jest.fn().mockResolvedValue([row()]);
    service = new AdminService(
      { findRecent } as unknown as IncomingMessagesRepository,
      configFor({ OPENWA_SESSION_ID: 'sess-1' }),
    );
  });

  it('devuelve el historial mapeado al contrato del panel', async () => {
    await expect(service.recent()).resolves.toEqual([
      {
        id: 'msg-1',
        receivedAt: '2026-02-02T10:00:00.000Z',
        chatId: '949309464@c.us',
        message: 'oye @Sn hola',
        reply: 'hola, humano 🤡',
      },
    ]);
  });

  it('devuelve null en reply cuando la IA todavía no respondió', async () => {
    findRecent.mockResolvedValueOnce([row({ reply: null })]);

    const [message] = await service.recent();

    expect(message.reply).toBeNull();
  });

  it('pide 100 filas por defecto y respeta el límite pedido', async () => {
    await service.recent();
    expect(findRecent).toHaveBeenLastCalledWith(100);

    await service.recent(20);
    expect(findRecent).toHaveBeenLastCalledWith(20);
  });

  it('acota el límite a 1..500 y tolera valores inválidos', async () => {
    await service.recent(9999);
    expect(findRecent).toHaveBeenLastCalledWith(500);

    await service.recent(0);
    expect(findRecent).toHaveBeenLastCalledWith(1);

    await service.recent(Number.NaN);
    expect(findRecent).toHaveBeenLastCalledWith(100);
  });

  it('expone la sesión de OpenWA del .env', () => {
    expect(service.status()).toEqual({ sessionId: 'sess-1' });
  });
});
