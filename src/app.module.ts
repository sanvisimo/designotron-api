import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { VideoModule } from './video/video.module';

@Module({
  imports: [AuthModule, UsersModule, VideoModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
