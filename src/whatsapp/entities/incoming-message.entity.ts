import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Mensaje entrante de OpenWA persistido en SQLite.
 *
 * El payload original completo se conserva en `raw` (JSON) porque OpenWA
 * agrega campos con el tiempo; las columnas sueltas son las que se consultan.
 */
@Entity('incoming_messages')
export class IncomingMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn()
  receivedAt: Date;

  @Column({ type: 'text', nullable: true })
  event: string | null;

  @Index()
  @Column({ type: 'text', nullable: true })
  sessionId: string | null;

  @Index()
  @Column({ type: 'text', nullable: true })
  chatId: string | null;

  @Column({ type: 'text', nullable: true })
  body: string | null;

  @Column({ type: 'text', nullable: true })
  messageType: string | null;

  /** Respuesta que se envió al chat (IA o fallback); null si aún no hay. */
  @Column({ type: 'text', nullable: true })
  reply: string | null;

  @Column({ type: 'boolean', default: false })
  fromMe: boolean;

  /** Payload tal cual llegó del webhook. */
  @Column({ type: 'simple-json', nullable: true })
  raw: unknown;
}
