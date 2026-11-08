import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /**
   * GET /health — público y sin datos: lo usan el healthcheck del contenedor,
   * el proxy y el ping de uptime que evita que una instancia free se duerma.
   */
  @Get('health')
  health(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
