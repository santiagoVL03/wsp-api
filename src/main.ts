import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // wsp-admin corre en otro origen (Next dev en :3000). Sin auth todavía.
  app.enableCors({ origin: true });

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
