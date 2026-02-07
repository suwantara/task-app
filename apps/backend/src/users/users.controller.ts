import {
  Controller,
  Get,
  Patch,
  Delete,
  Body,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Controller('users')
@UseGuards(AuthGuard('jwt'))
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getProfile(@Request() req) {
    const user = await this.usersService.findById(req.user.userId);
    if (!user) return null;
    const { passwordHash, ...result } = user;
    return result;
  }

  @Patch('me')
  async updateProfile(@Request() req, @Body() dto: UpdateUserDto) {
    return this.usersService.updateProfile(req.user.userId, dto);
  }

  @Patch('me/password')
  async updatePassword(@Request() req, @Body() dto: UpdatePasswordDto) {
    return this.usersService.updatePassword(req.user.userId, dto);
  }

  @Get('me/settings')
  async getSettings(@Request() req) {
    return this.usersService.getSettings(req.user.userId);
  }

  @Patch('me/settings')
  async updateSettings(@Request() req, @Body() dto: UpdateSettingsDto) {
    return this.usersService.updateSettings(req.user.userId, dto);
  }

  @Delete('me')
  async deleteAccount(@Request() req) {
    return this.usersService.deleteAccount(req.user.userId);
  }
}
