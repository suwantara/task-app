import {
  Controller,
  Get,
  Patch,
  Delete,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { CurrentUser } from '../common/decorators/user.decorator';

interface AuthenticatedUser {
  readonly userId: string;
  readonly email: string;
}

@Controller('users')
@UseGuards(AuthGuard('jwt'))
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getProfile(@CurrentUser() user: AuthenticatedUser) {
    const found = await this.usersService.findById(user.userId);
    if (!found) return null;
    const { passwordHash, ...result } = found;
    return result;
  }

  @Patch('me')
  async updateProfile(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateUserDto) {
    return this.usersService.updateProfile(user.userId, dto);
  }

  @Patch('me/password')
  async updatePassword(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdatePasswordDto) {
    return this.usersService.updatePassword(user.userId, dto);
  }

  @Get('me/settings')
  async getSettings(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getSettings(user.userId);
  }

  @Patch('me/settings')
  async updateSettings(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateSettingsDto) {
    return this.usersService.updateSettings(user.userId, dto);
  }

  @Delete('me')
  async deleteAccount(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.deleteAccount(user.userId);
  }
}
