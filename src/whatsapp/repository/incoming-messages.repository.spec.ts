import { DataSource, Repository } from 'typeorm';
import { IncomingMessage } from '../entities/incoming-message.entity';
import { IncomingMessagesRepository } from './incoming-messages.repository';

describe('IncomingMessagesRepository (SQLite real)', () => {
  let dataSource: DataSource;
  let repository: IncomingMessagesRepository;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'sqljs',
      // Sin `location`: la base vive en memoria solo durante el test.
      synchronize: true,
      entities: [IncomingMessage],
    });
    await dataSource.initialize();

    const typeormRepo = dataSource.getRepository(
      IncomingMessage,
    ) as Repository<IncomingMessage>;
    repository = new IncomingMessagesRepository(typeormRepo);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  afterEach(async () => {
    await dataSource.getRepository(IncomingMessage).clear();
  });

  const webhook = (body: string, extra: Record<string, unknown> = {}) => ({
    event: 'message.received',
    sessionId: 'session-1',
    data: { chatId: '949309464@c.us', body, type: 'text', ...extra },
  });

  it('guarda el mensaje con sus columnas y el payload completo', async () => {
    const payload = webhook('@bot-pruebas-k6');
    const saved = await repository.saveFromWebhook(payload);

    expect(saved.id).toBeDefined();
    expect(saved.chatId).toBe('949309464@c.us');
    expect(saved.body).toBe('@bot-pruebas-k6');
    expect(saved.messageType).toBe('text');
    expect(saved.event).toBe('message.received');
    expect(saved.sessionId).toBe('session-1');
    expect(saved.fromMe).toBe(false);
    expect(saved.receivedAt).toBeInstanceOf(Date);
    expect(saved.raw).toEqual(payload);

    expect(await repository.count()).toBe(1);
  });

  it('acepta el payload plano (sin envelope data)', async () => {
    const saved = await repository.saveFromWebhook({
      chatId: '1203630@g.us',
      body: '@Sn hola',
      type: 'text',
    });

    expect(saved.chatId).toBe('1203630@g.us');
    expect(saved.body).toBe('@Sn hola');
    expect(saved.event).toBeNull();
    expect(saved.sessionId).toBeNull();
  });

  it('devuelve los mensajes recientes primero y filtra por chat', async () => {
    await repository.saveFromWebhook(webhook('primero'));
    await repository.saveFromWebhook(webhook('segundo'));
    await repository.saveFromWebhook({
      event: 'message.received',
      data: { chatId: 'otro@c.us', body: 'de otro chat', type: 'text' },
    });

    const recientes = await repository.findRecent();
    expect(recientes).toHaveLength(3);
    expect(await repository.count()).toBe(3);

    const delChat = await repository.findByChatId('949309464@c.us');
    expect(
      delChat
        .map((m) => m.body)
        .sort((a, b) => String(a).localeCompare(String(b))),
    ).toEqual(['primero', 'segundo']);

    const limitado = await repository.findRecent(1);
    expect(limitado).toHaveLength(1);
  });

  it('modifica, busca por id y borra', async () => {
    const saved = await repository.saveFromWebhook(webhook('original'));

    const updated = await repository.update(saved.id, { body: 'editado' });
    expect(updated?.body).toBe('editado');

    const found = await repository.findById(saved.id);
    expect(found?.body).toBe('editado');

    expect(await repository.deleteById(saved.id)).toBe(true);
    expect(await repository.deleteById(saved.id)).toBe(false);
    expect(await repository.count()).toBe(0);
  });
});
