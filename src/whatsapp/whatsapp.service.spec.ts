import { ConfigService } from '@nestjs/config';
import { LlmService } from '../llm/llm.service';
import { MessagesGateway } from '../realtime/messages.gateway';
import { OpenwaService } from './openwa.service';
import { IncomingMessagesRepository } from './repository/incoming-messages.repository';
import { WhatsappService } from './whatsapp.service';

describe('WhatsappService', () => {
  let sendText: jest.Mock;
  let saveFromWebhook: jest.Mock;
  let saveReply: jest.Mock;
  let generateReply: jest.Mock;
  let fallbackReply: jest.Mock;
  let emitNew: jest.Mock;
  let emitUpdated: jest.Mock;
  let service: WhatsappService;

  const env: Record<string, string> = {
    BOT_PRUEBAS_K6_TRIGGER: '@bot-pruebas-k6',
    PSEUDONIMO_TRIGGER: '@Sn',
    LLM_ERROR_REPLY: 'fallback configurado 💀',
  };

  const configFor = (values: Record<string, string>) =>
    ({
      get: jest.fn((key: string) => values[key]),
    }) as unknown as ConfigService;

  const webhook = (body: string, extra: Record<string, unknown> = {}) => ({
    event: 'message.received',
    sessionId: 'session-1',
    data: { chatId: '949309464@c.us', body, type: 'text', ...extra },
  });

  const savedRow = {
    id: 'msg-1',
    receivedAt: new Date('2026-02-02T10:00:00.000Z'),
    chatId: '949309464@c.us',
    body: '@bot-pruebas-k6',
    reply: null,
  };

  const buildService = (configService: ConfigService) =>
    new WhatsappService(
      { sendText } as unknown as OpenwaService,
      configService,
      {
        saveFromWebhook,
        saveReply,
      } as unknown as IncomingMessagesRepository,
      {
        generateReply,
        fallbackReply,
      } as unknown as LlmService,
      { emitNew, emitUpdated } as unknown as MessagesGateway,
    );

  beforeEach(() => {
    sendText = jest.fn().mockResolvedValue(undefined);
    saveFromWebhook = jest.fn().mockResolvedValue({ ...savedRow });
    saveReply = jest
      .fn()
      .mockImplementation((id: string, reply: string) =>
        Promise.resolve({ ...savedRow, id, reply }),
      );
    generateReply = jest.fn().mockResolvedValue('respuesta de la IA 🤡');
    fallbackReply = jest.fn().mockReturnValue('fallback configurado 💀');
    emitNew = jest.fn();
    emitUpdated = jest.fn();
    service = buildService(configFor(env));
  });

  it('responde con el texto que genera la IA ante el disparador exacto', async () => {
    await service.handleWebhook(webhook('@bot-pruebas-k6'));

    expect(generateReply).toHaveBeenCalledWith('@bot-pruebas-k6');
    expect(sendText).toHaveBeenCalledWith(
      '949309464@c.us',
      'respuesta de la IA 🤡',
    );
  });

  it('le pasa a la IA el texto sin la mención', async () => {
    await service.handleWebhook(webhook('oye @Sn cómo estás'));

    expect(generateReply).toHaveBeenCalledWith('oye cómo estás');
    expect(sendText).toHaveBeenCalledWith(
      '949309464@c.us',
      'respuesta de la IA 🤡',
    );
  });

  it('guarda el mensaje original en la base de datos vía el repository', async () => {
    const payload = webhook('@bot-pruebas-k6');
    await service.handleWebhook(payload);

    expect(saveFromWebhook).toHaveBeenCalledTimes(1);
    expect(saveFromWebhook).toHaveBeenCalledWith(payload);
  });

  it('guarda la respuesta del bot junto al mensaje', async () => {
    await service.handleWebhook(webhook('@bot-pruebas-k6'));

    expect(saveReply).toHaveBeenCalledWith('msg-1', 'respuesta de la IA 🤡');
  });

  it('avisa al panel del mensaje nuevo y de la respuesta', async () => {
    await service.handleWebhook(webhook('@bot-pruebas-k6'));

    expect(emitNew).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'msg-1',
        message: '@bot-pruebas-k6',
        reply: null,
      }),
    );
    expect(emitUpdated).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'msg-1', reply: 'respuesta de la IA 🤡' }),
    );
  });

  it('manda el mensaje sarcástico por defecto si la IA falla', async () => {
    generateReply.mockRejectedValueOnce(new Error('timeout of 15000ms exceeded'));

    await service.handleWebhook(webhook('@Sn hola'));

    expect(fallbackReply).toHaveBeenCalled();
    expect(sendText).toHaveBeenCalledWith(
      '949309464@c.us',
      'fallback configurado 💀',
    );
    // El panel muestra lo mismo que se envió al chat.
    expect(saveReply).toHaveBeenCalledWith('msg-1', 'fallback configurado 💀');
  });

  it('responde aunque falle el guardado en la base de datos', async () => {
    saveFromWebhook.mockRejectedValueOnce(new Error('SQLITE_BUSY'));

    await service.handleWebhook(webhook('@bot-pruebas-k6'));

    expect(sendText).toHaveBeenCalledWith(
      '949309464@c.us',
      'respuesta de la IA 🤡',
    );
    // Sin fila guardada no hay nada que anotar ni que emitir.
    expect(emitNew).not.toHaveBeenCalled();
    expect(saveReply).not.toHaveBeenCalled();
  });

  it('toma los disparadores del .env', async () => {
    const custom = buildService(
      configFor({
        BOT_PRUEBAS_K6_TRIGGER: '@otro-bot',
        PSEUDONIMO_TRIGGER: '@Alias',
      }),
    );

    await custom.handleWebhook(webhook('hola @Alias'));

    expect(generateReply).toHaveBeenCalledWith('hola');
  });

  it('no responde si faltan los disparadores en el .env', async () => {
    const sinEnv = buildService(configFor({}));

    await sinEnv.handleWebhook(webhook('@bot-pruebas-k6'));

    expect(generateReply).not.toHaveBeenCalled();
    expect(sendText).not.toHaveBeenCalled();
  });

  it('no responde a mensajes sin mención', async () => {
    await service.handleWebhook(webhook('hola, ¿precio del plan?'));

    expect(generateReply).not.toHaveBeenCalled();
    expect(sendText).not.toHaveBeenCalled();
    expect(saveFromWebhook).not.toHaveBeenCalled();
  });

  it('no responde a sus propios mensajes ni a otros eventos', async () => {
    await service.handleWebhook(webhook('@Sn', { fromMe: true }));
    await service.handleWebhook({
      event: 'message.sent',
      data: { chatId: '949309464@c.us', body: '@Sn' },
    });

    expect(generateReply).not.toHaveBeenCalled();
    expect(sendText).not.toHaveBeenCalled();
    expect(saveFromWebhook).not.toHaveBeenCalled();
  });
});
