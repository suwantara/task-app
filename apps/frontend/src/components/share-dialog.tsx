'use client';

import { useState } from 'react';
import {
  useWorkspaceMembers,
  useInviteLinks,
  useJoinCodes,
  useRevokeInviteLink,
  useUpdateMemberRole,
  useRemoveMember,
  useRegenerateJoinCode,
} from '@/hooks/use-queries';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Copy,
  Check,
  Trash2,
  Crown,
  Pencil,
  Eye,
  UserMinus,
  Loader2,
  RefreshCw,
  Hash,
} from 'lucide-react';


interface InviteLink {
  id: string;
  token: string;
  role: string;
  isActive: boolean;
  expiresAt?: string;
  maxUses?: number;
  useCount: number;
  createdAt: string;
  createdBy?: { id: string; name: string; email: string };
}

interface Member {
  id: string;
  userId: string;
  role: string;
  joinedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
  };
}

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  workspaceName: string;
  currentUserId: string;
  isOwner: boolean;
}

export function ShareDialog({
  open,
  onOpenChange,
  workspaceId,
  workspaceName,
  currentUserId,
  isOwner,
}: Readonly<ShareDialogProps>) {
  const { data: members = [], isLoading: membersLoading } = useWorkspaceMembers(workspaceId);
  const { data: inviteLinks = [] } = useInviteLinks(workspaceId);
  const { data: joinCodes = null } = useJoinCodes(workspaceId, isOwner);

  const revokeLinkMutation = useRevokeInviteLink();
  const updateRoleMutation = useUpdateMemberRole();
  const removeMemberMutation = useRemoveMember();
  const regenerateCodeMutation = useRegenerateJoinCode();

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyLink = async (token: string, linkId: string) => {
    const url = `${globalThis.location.origin}/join/${token}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(linkId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyCode = async (code: string, codeType: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedId(codeType);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRegenerateCode = async (role: 'EDITOR' | 'VIEWER') => {
    try {
      await regenerateCodeMutation.mutateAsync({ workspaceId, role });
    } catch (error) {
      console.error('Failed to regenerate code:', error);
    }
  };

  const handleRevokeLink = async (linkId: string) => {
    try {
      await revokeLinkMutation.mutateAsync({ linkId, workspaceId });
    } catch (error) {
      console.error('Failed to revoke link:', error);
    }
  };

  const handleUpdateRole = async (memberId: string, role: string) => {
    try {
      await updateRoleMutation.mutateAsync({ workspaceId, memberId, role });
    } catch (error) {
      console.error('Failed to update role:', error);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      await removeMemberMutation.mutateAsync({ workspaceId, memberId });
    } catch (error) {
      console.error('Failed to remove member:', error);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'OWNER':
        return <Crown className="size-3.5" />;
      case 'EDITOR':
        return <Pencil className="size-3.5" />;
      case 'VIEWER':
        return <Eye className="size-3.5" />;
      default:
        return null;
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'OWNER':
        return 'default' as const;
      case 'EDITOR':
        return 'secondary' as const;
      case 'VIEWER':
        return 'outline' as const;
      default:
        return 'outline' as const;
    }
  };

  const renderMemberRoleBadge = (member: Member) => {
    if (member.role === 'OWNER') {
      return (
        <Badge variant="default" className="gap-1">
          <Crown className="size-3" />
          Owner
        </Badge>
      );
    }

    if (isOwner && member.userId !== currentUserId) {
      return (
        <div className="flex items-center gap-1">
          <Select
            value={member.role}
            onValueChange={(val) => handleUpdateRole(member.id, val)}
          >
            <SelectTrigger className="h-7 w-24 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="EDITOR">Editor</SelectItem>
              <SelectItem value="VIEWER">Viewer</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-destructive hover:text-destructive"
            onClick={() => handleRemoveMember(member.id)}
          >
            <UserMinus className="size-3.5" />
          </Button>
        </div>
      );
    }

    return (
      <Badge variant={getRoleBadgeVariant(member.role)} className="gap-1">
        {getRoleIcon(member.role)}
        {(member.role ?? 'VIEWER').charAt(0) + (member.role ?? 'VIEWER').slice(1).toLowerCase()}
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Share &quot;{workspaceName}&quot;</DialogTitle>
          <DialogDescription>
            Invite people to collaborate on this workspace
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="members" className="mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="members">
              Members ({members.length})
            </TabsTrigger>
            <TabsTrigger value="links">
              Invite Links
            </TabsTrigger>
          </TabsList>

          {/* Members Tab */}
          <TabsContent value="members" className="space-y-3">
            {membersLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="max-h-72 space-y-1 overflow-y-auto">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/50"
                  >
                    <Avatar className="size-8">
                      <AvatarFallback className="text-xs">
                        {(member.user?.name ?? '?').charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {member.user?.name ?? 'Unknown'}
                        {member.userId === currentUserId && (
                          <span className="ml-1 text-xs text-muted-foreground">(you)</span>
                        )}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {member.user?.email ?? ''}
                      </p>
                    </div>

                    {renderMemberRoleBadge(member)}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Join Codes Tab */}
          <TabsContent value="links" className="space-y-4">
            {/* Join Codes Section - Primary */}
            {isOwner && joinCodes ? (
              <div className="space-y-4">
                <div className="space-y-1">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Hash className="size-4 text-muted-foreground" />
                    Join Codes
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Share these 6-character codes for quick access
                  </p>
                </div>
                
                {/* Editor Code */}
                <div className="rounded-lg border bg-gradient-to-br from-blue-500/5 to-indigo-500/10 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="gap-1 bg-blue-500/10 text-blue-600 border-blue-500/20">
                      <Pencil className="size-3" />
                      Editor
                    </Badge>
                    <span className="text-xs text-muted-foreground">Can edit tasks & boards</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <code className="font-mono text-2xl font-bold tracking-[0.3em]">
                      {joinCodes.editorJoinCode}
                    </code>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopyCode(joinCodes.editorJoinCode, 'editor')}
                      >
                        {copiedId === 'editor' ? (
                          <><Check className="size-3.5 mr-1.5 text-green-500" /> Copied</>
                        ) : (
                          <><Copy className="size-3.5 mr-1.5" /> Copy Code</>
                        )}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8"
                        onClick={() => handleRegenerateCode('EDITOR')}
                        disabled={regenerateCodeMutation.isPending && regenerateCodeMutation.variables?.role === 'EDITOR'}
                      >
                        <RefreshCw className={`size-4 ${regenerateCodeMutation.isPending && regenerateCodeMutation.variables?.role === 'EDITOR' ? 'animate-spin' : ''}`} />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Viewer Code */}
                <div className="rounded-lg border bg-gradient-to-br from-slate-500/5 to-gray-500/10 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="gap-1">
                      <Eye className="size-3" />
                      Viewer
                    </Badge>
                    <span className="text-xs text-muted-foreground">View only access</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <code className="font-mono text-2xl font-bold tracking-[0.3em]">
                      {joinCodes.viewerJoinCode}
                    </code>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopyCode(joinCodes.viewerJoinCode, 'viewer')}
                      >
                        {copiedId === 'viewer' ? (
                          <><Check className="size-3.5 mr-1.5 text-green-500" /> Copied</>
                        ) : (
                          <><Copy className="size-3.5 mr-1.5" /> Copy Code</>
                        )}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8"
                        onClick={() => handleRegenerateCode('VIEWER')}
                        disabled={regenerateCodeMutation.isPending && regenerateCodeMutation.variables?.role === 'VIEWER'}
                      >
                        <RefreshCw className={`size-4 ${regenerateCodeMutation.isPending && regenerateCodeMutation.variables?.role === 'VIEWER' ? 'animate-spin' : ''}`} />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Link generation - collapsed by default */}
                {inviteLinks.length > 0 && (
                  <div className="pt-2 border-t space-y-2">
                    <Label className="text-xs text-muted-foreground">Legacy Invite Links</Label>
                    <div className="max-h-32 space-y-2 overflow-y-auto">
                      {inviteLinks.map((link) => (
                        <div
                          key={link.id}
                          className={`flex items-center gap-2 rounded-md border p-2 text-xs ${
                            link.isActive ? '' : 'opacity-50'
                          }`}
                        >
                          <Badge
                            variant={getRoleBadgeVariant(link.role)}
                            className="gap-1 text-[10px]"
                          >
                            {getRoleIcon(link.role)}
                            {link.role}
                          </Badge>
                          {!link.isActive && (
                            <Badge variant="destructive" className="text-[10px]">
                              Revoked
                            </Badge>
                          )}
                          <span className="text-[10px] text-muted-foreground flex-1">
                            {link.useCount} use{link.useCount === 1 ? '' : 's'}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6"
                            onClick={() => handleCopyLink(link.token, link.id)}
                            disabled={!link.isActive}
                          >
                            {copiedId === link.id ? (
                              <Check className="size-3 text-green-500" />
                            ) : (
                              <Copy className="size-3" />
                            )}
                          </Button>
                          {link.isActive && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-6 text-destructive hover:text-destructive"
                              onClick={() => handleRevokeLink(link.id)}
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {membersLoading ? (
                  <Loader2 className="size-5 animate-spin mx-auto" />
                ) : (
                  'Only workspace owners can view join codes'
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
