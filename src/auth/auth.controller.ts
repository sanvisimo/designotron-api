import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { LocalAuthGuard } from './local-auth.guard';
import { User as UserModel } from '@prisma/client';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Request() req) {
    return this.authService.login(req.user);
  }

  @UseGuards(LocalAuthGuard)
  @Post('logout')
  async logout(@Request() req) {
    return req.logout();
  }

  @Post('signup')
  async signupUser(
    @Body()
    userData: {
      email: string;
      password: string;
      username: string;
    },
  ): Promise<UserModel> {
    return this.usersService.createUser(userData);
  }
}
