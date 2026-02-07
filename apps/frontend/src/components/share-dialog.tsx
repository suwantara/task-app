'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Link2,
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
  const [members, setMembers] = useState<Member[]>([]);
  const [inviteLinks, setInviteLinks] = useState<InviteLink[]>([]);
  const [joinCodes, setJoinCodes] = useState<{ editorJoinCode: string; viewerJoinCode: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [newLinkRole, setNewLinkRole] = useState<string>('EDITOR');
  const [creatingLink, setCreatingLink] = useState(false);
  const [regeneratingCode, setRegeneratingCode] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const [membersData, linksData, codesData] = await Promise.all([
        apiClient.getWorkspaceMembers(workspaceId),
        apiClient.getInviteLinks(workspaceId).catch(() => []),
        isOwner ? apiClient.getJoinCodes(workspaceId).catch(() => null) : Promise.resolve(null),
      ]);
      setMembers(membersData);
      setInviteLinks(linksData);
      setJoinCodes(codesData);
    } catch (error) {
      console.error('Failed to load share data:', error);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, isOwner]);

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, loadData]);

  const handleCreateLink = async () => {
    setCreatingLink(true);
    try {
      await apiClient.createInviteLink(workspaceId, { role: newLinkRole });
      await loadData();
    } catch (error) {
      console.error('Failed to create invite link:', error);
    } finally {
      setCreatingLink(false);
    }
  };

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
    setRegeneratingCode(role);
    try {
      await apiClient.regenerateJoinCode(workspaceId, role);
      await loadData();
    } catch (error) {
      console.error('Failed to regenerate code:', error);
    } finally {
      setRegeneratingCode(null);
    }
  };

  const handleRevokeLink = async (linkId: string) => {
    try {
      await apiClient.revokeInviteLink(linkId);
      await loadData();
    } catch (error) {
      console.error('Failed to revoke link:', error);
    }
  };

  const handleUpdateRole = async (memberId: string, role: string) => {
    try {
      await apiClient.updateMemberRole(workspaceId, memberId, role);
      await loadData();
    } catch (error) {
      console.error('Failed to update role:', error);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      await apiClient.removeMember(workspaceId, memberId);
      await loadData();
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
            {loading ? (
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

          {/* Invite Links Tab */}
          <TabsContent value="links" className="space-y-4">
            {/* Quick Join Codes (owner only) */}
            {isOwner && joinCodes && (
              <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                <div className="flex items-center gap-2">
                  <Hash className="size-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Quick Join Codes</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Share these 6-character codes for easy joining
                </p>
                <div className="grid gap-3">
                  {/* Editor Code */}
                  <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary" className="gap-1">
                        <Pencil className="size-3" />
                        Editor
                      </Badge>
                      <code className="font-mono text-lg font-bold tracking-widest">
                        {joinCodes.editorJoinCode}
                      </code>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8"
                        onClick={() => handleCopyCode(joinCodes.editorJoinCode, 'editor')}
                      >
                        {copiedId === 'editor' ? (
                          <Check className="size-4 text-green-500" />
                        ) : (
                          <Copy className="size-4" />
                        )}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8"
                        onClick={() => handleRegenerateCode('EDITOR')}
                        disabled={regeneratingCode === 'EDITOR'}
                      >
                        <RefreshCw className={`size-4 ${regeneratingCode === 'EDITOR' ? 'animate-spin' : ''}`} />
                      </Button>
                    </div>
                  </div>
                  {/* Viewer Code */}
                  <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="gap-1">
                        <Eye className="size-3" />
                        Viewer
                      </Badge>
                      <code className="font-mono text-lg font-bold tracking-widest">
                        {joinCodes.viewerJoinCode}
                      </code>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8"
                        onClick={() => handleCopyCode(joinCodes.viewerJoinCode, 'viewer')}
                      >
                        {copiedId === 'viewer' ? (
                          <Check className="size-4 text-green-500" />
                        ) : (
                          <Copy className="size-4" />
                        )}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8"
                        onClick={() => handleRegenerateCode('VIEWER')}
                        disabled={regeneratingCode === 'VIEWER'}
                      >
                        <RefreshCw className={`size-4 ${regeneratingCode === 'VIEWER' ? 'animate-spin' : ''}`} />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Create new link */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Create invite link</Label>
              <div className="flex gap-2">
                <Select value={newLinkRole} onValueChange={setNewLinkRole}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EDITOR">Editor</SelectItem>
                    <SelectItem value="VIEWER">Viewer</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleCreateLink}
                  disabled={creatingLink}
                  className="flex-1"
                >
                  {creatingLink ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <Link2 className="mr-2 size-4" />
                  )}
                  Generate Link
                </Button>
              </div>
            </div>

            {/* Existing links */}
            <div className="max-h-52 space-y-2 overflow-y-auto">
              {inviteLinks.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No invite links created yet
                </p>
              ) : (
                inviteLinks.map((link) => (
                  <div
                    key={link.id}
                    className={`flex items-center gap-2 rounded-lg border p-2.5 ${
                      link.isActive ? '' : 'opacity-50'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
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
                        <span className="text-[10px] text-muted-foreground">
                          {link.useCount} use{link.useCount === 1 ? '' : 's'}
                          {link.maxUses ? ` / ${link.maxUses}` : ''}
                        </span>
                      </div>
                      <Input
                        readOnly
                        value={`${typeof globalThis !== 'undefined' && globalThis.location ? globalThis.location.origin : ''}/join/${link.token}`}
                        className="mt-1.5 h-7 text-xs"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => handleCopyLink(link.token, link.id)}
                        disabled={!link.isActive}
                      >
                        {copiedId === link.id ? (
                          <Check className="size-3.5 text-green-500" />
                        ) : (
                          <Copy className="size-3.5" />
                        )}
                      </Button>
                      {link.isActive && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-destructive hover:text-destructive"
                          onClick={() => handleRevokeLink(link.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
