import { Module } from '@nestjs/common';
import { VideoService } from './video.service';
import { VideoController } from './video.controller';
import { AuthService } from '../auth/auth.service';
import { LocalStrategy } from '../auth/local.strategy';
import { JwtStrategy } from '../auth/jwt.strategy';
import { PuppeteerService } from './puppeteer.service';

@Module({
  controllers: [VideoController],
  providers: [VideoService, PuppeteerService],
})
export class VideoModule {}
