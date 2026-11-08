import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LlmModule } from '../llm/llm.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { IncomingMessage } from './entities/incoming-message.entity';
import { OpenwaService } from './openwa.service';
import { IncomingMessagesRepository } from './repository/incoming-messages.repository';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';

@Module({
  imports: [
    HttpModule,
    LlmModule,
    RealtimeModule,
    TypeOrmModule.forFeature([IncomingMessage]),
  ],
  controllers: [WhatsappController],
  providers: [OpenwaService, IncomingMessagesRepository, WhatsappService],
  // El panel (AdminModule) reutiliza el repository en vez de duplicarlo.
  exports: [IncomingMessagesRepository],
})
export class WhatsappModule {}
