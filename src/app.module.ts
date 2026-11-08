import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { AdminModule } from './admin/admin.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WhatsappModule } from './whatsapp/whatsapp.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): TypeOrmModuleOptions => {
        // Archivo SQLite real; él lo crea si no existe y lo vuelca en cada
        // escritura (autoSave). Las entidades las registra cada módulo con
        // TypeOrmModule.forFeature y autoLoadEntities las engancha aquí.
        const location = resolve(
          config.get<string>('DATABASE_PATH') ?? './.data/wsp.sqlite',
        );
        mkdirSync(dirname(location), { recursive: true });

        return {
          type: 'sqljs',
          location,
          autoSave: true,
          // Sin migraciones todavía: el esquema sigue a las entidades.
          synchronize: true,
          autoLoadEntities: true,
          logging: false,
        };
      },
    }),
    WhatsappModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
