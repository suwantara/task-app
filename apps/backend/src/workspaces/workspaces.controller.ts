import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { WorkspacesService } from './workspaces.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { CreateInviteLinkDto, UpdateMemberRoleDto } from './dto/create-invite-link.dto';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../common/decorators/user.decorator';

@UseGuards(AuthGuard('jwt'))
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Post()
  create(
    @CurrentUser() user: { userId: string },
    @Body() createWorkspaceDto: CreateWorkspaceDto,
  ) {
    return this.workspacesService.create(user.userId, createWorkspaceDto);
  }

  @Get()
  findAll(@CurrentUser() user: { userId: string }) {
    return this.workspacesService.findAll(user.userId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.workspacesService.findOne(id, user.userId);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() updateWorkspaceDto: UpdateWorkspaceDto,
  ) {
    return this.workspacesService.update(id, user.userId, updateWorkspaceDto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.workspacesService.remove(id, user.userId);
  }

  // ============================================
  // INVITE LINKS
  // ============================================

  @Post(':id/invite-links')
  createInviteLink(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() dto: CreateInviteLinkDto,
  ) {
    return this.workspacesService.createInviteLink(id, user.userId, dto);
  }

  @Get(':id/invite-links')
  getInviteLinks(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
  ) {
    return this.workspacesService.getInviteLinks(id, user.userId);
  }

  @Delete('invite-links/:linkId')
  revokeInviteLink(
    @CurrentUser() user: { userId: string },
    @Param('linkId') linkId: string,
  ) {
    return this.workspacesService.revokeInviteLink(linkId, user.userId);
  }

  @Get('join/:token/info')
  getInviteLinkInfo(@Param('token') token: string) {
    return this.workspacesService.getInviteLinkInfo(token);
  }

  @Post('join/:token')
  joinByInviteLink(
    @CurrentUser() user: { userId: string },
    @Param('token') token: string,
  ) {
    return this.workspacesService.joinByInviteLink(token, user.userId);
  }

  // ============================================
  // MEMBERS
  // ============================================

  @Get(':id/members')
  getMembers(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
  ) {
    return this.workspacesService.getMembers(id, user.userId);
  }

  @Patch(':id/members/:memberId')
  updateMemberRole(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.workspacesService.updateMemberRole(id, memberId, user.userId, dto);
  }

  @Delete(':id/members/:memberId')
  removeMember(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Param('memberId') memberId: string,
  ) {
    return this.workspacesService.removeMember(id, memberId, user.userId);
  }
}
