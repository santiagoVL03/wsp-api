import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { LlmService } from './llm.service';

@Module({
  imports: [HttpModule],
  providers: [LlmService],
  exports: [LlmService],
})
export class LlmModule {}
