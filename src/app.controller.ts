import { Controller, Get, UseGuards } from '@nestjs/common';
import { AppService } from './app.service';
import { JwtAuthGuard } from './auth/jwt-auth.guard';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  getHello(): Record<string, unknown> {
    return this.appService.getHello();
  }

  @Get('test')
  getTest(): string {
    return 'Ready, Go!';
  }
}
