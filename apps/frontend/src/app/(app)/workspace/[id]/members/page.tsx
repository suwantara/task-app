'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Copy, RefreshCw, Trash2, Users, Shield, Eye, Pencil, MoreHorizontal, Link, UserPlus, Crown } from 'lucide-react';

interface Member {
  id: string;
  role: 'OWNER' | 'EDITOR' | 'VIEWER';
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
  };
}

interface JoinCodes {
  editorJoinCode: string;
  viewerJoinCode: string;
}

interface Workspace {
  id: string;
  name: string;
  ownerId: string;
}

async function fetchMembers(workspaceId: string): Promise<Member[]> {
  const token = localStorage.getItem('token');
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/workspaces/${workspaceId}/members`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error('Failed to fetch members');
  return res.json();
}

async function fetchJoinCodes(workspaceId: string): Promise<JoinCodes | null> {
  const token = localStorage.getItem('token');
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/workspaces/${workspaceId}/join-codes`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (res.status === 403) return null; // Not owner
  if (!res.ok) throw new Error('Failed to fetch codes');
  return res.json();
}

async function fetchWorkspace(workspaceId: string): Promise<Workspace> {
  const token = localStorage.getItem('token');
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/workspaces/${workspaceId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error('Failed to fetch workspace');
  return res.json();
}

export default function WorkspaceMembersPage() {
  const params = useParams();
  const workspaceId = params.id as string;

  const queryClient = useQueryClient();
  const [regenerating, setRegenerating] = useState<string | null>(null);

  const { data: workspace } = useQuery({
    queryKey: ['workspace', workspaceId],
    queryFn: () => fetchWorkspace(workspaceId),
  });

  const { data: members = [], isLoading: loadingMembers } = useQuery({
    queryKey: ['workspace-members', workspaceId],
    queryFn: () => fetchMembers(workspaceId),
  });

  const { data: joinCodes } = useQuery({
    queryKey: ['workspace-join-codes', workspaceId],
    queryFn: () => fetchJoinCodes(workspaceId),
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: string }) => {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/workspaces/${workspaceId}/members/${memberId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ role }),
        }
      );
      if (!res.ok) throw new Error('Failed to update role');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-members', workspaceId] });
      toast.success('Role updated');
    },
    onError: () => {
      toast.error('Failed to update role');
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/workspaces/${workspaceId}/members/${memberId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!res.ok) throw new Error('Failed to remove member');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-members', workspaceId] });
      toast.success('Member removed');
    },
    onError: () => {
      toast.error('Failed to remove member');
    },
  });

  const handleRegenerateCode = async (role: 'EDITOR' | 'VIEWER') => {
    setRegenerating(role);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/workspaces/${workspaceId}/join-codes/${role}/regenerate`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!res.ok) throw new Error('Failed to regenerate code');
      queryClient.invalidateQueries({ queryKey: ['workspace-join-codes', workspaceId] });
      toast.success('Code regenerated', { description: `New ${role} code generated` });
    } catch {
      toast.error('Failed to regenerate code');
    } finally {
      setRegenerating(null);
    }
  };

  const copyCode = (code: string, role: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Copied!', { description: `${role} code copied to clipboard` });
  };

  const copyInviteLink = (code: string, role: string) => {
    const link = `${window.location.origin}/join/${code}`;
    navigator.clipboard.writeText(link);
    toast.success('Link Copied!', { description: `${role} invite link copied` });
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'OWNER':
        return (
          <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 shadow-sm">
            <Crown className="h-3 w-3 mr-1" /> Owner
          </Badge>
        );
      case 'EDITOR':
        return (
          <Badge className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white border-0 shadow-sm">
            <Pencil className="h-3 w-3 mr-1" /> Editor
          </Badge>
        );
      case 'VIEWER':
        return (
          <Badge variant="secondary" className="shadow-sm">
            <Eye className="h-3 w-3 mr-1" /> Viewer
          </Badge>
        );
      default:
        return <Badge>{role}</Badge>;
    }
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-gradient-to-br from-pink-500 to-rose-500',
      'bg-gradient-to-br from-violet-500 to-purple-500',
      'bg-gradient-to-br from-blue-500 to-cyan-500',
      'bg-gradient-to-br from-emerald-500 to-teal-500',
      'bg-gradient-to-br from-amber-500 to-orange-500',
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const currentUserId = globalThis.window ? localStorage.getItem('userId') : null;
  const isOwner = workspace?.ownerId === currentUserId;

  if (loadingMembers) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
          <p className="text-muted-foreground text-sm">Loading members...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto max-w-3xl space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 border">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {workspace?.name} - Members
            </h1>
            <p className="text-muted-foreground text-sm">
              Manage workspace members and permissions
            </p>
          </div>
        </div>
      </div>

      {/* Join Codes Section - Only visible to owner */}
      {joinCodes && (
        <Card className="border-dashed">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-muted-foreground" />
              Invite Members
            </CardTitle>
            <CardDescription>
              Share these codes or links to invite people to your workspace
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Editor Code */}
              <div className="group relative overflow-hidden rounded-xl border bg-gradient-to-br from-blue-500/5 to-indigo-500/10 p-5 transition-all hover:shadow-md hover:border-blue-500/30">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium flex items-center gap-2 text-sm">
                      <Pencil className="h-4 w-4 text-blue-500" /> Editor Access
                    </span>
                    <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">
                      Can Edit
                    </Badge>
                  </div>
                  <code className="block text-3xl font-mono tracking-[0.3em] text-center py-2">
                    {joinCodes.editorJoinCode}
                  </code>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => copyCode(joinCodes.editorJoinCode, 'Editor')}
                    >
                      <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy Code
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => copyInviteLink(joinCodes.editorJoinCode, 'Editor')}
                    >
                      <Link className="h-3.5 w-3.5 mr-1.5" /> Copy Link
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="shrink-0"
                      onClick={() => handleRegenerateCode('EDITOR')}
                      disabled={regenerating === 'EDITOR'}
                    >
                      <RefreshCw className={`h-4 w-4 ${regenerating === 'EDITOR' ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Viewer Code */}
              <div className="group relative overflow-hidden rounded-xl border bg-gradient-to-br from-slate-500/5 to-gray-500/10 p-5 transition-all hover:shadow-md hover:border-slate-500/30">
                <div className="absolute inset-0 bg-gradient-to-br from-slate-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium flex items-center gap-2 text-sm">
                      <Eye className="h-4 w-4 text-slate-500" /> Viewer Access
                    </span>
                    <Badge variant="secondary" className="bg-slate-500/10 text-slate-500 border-slate-500/20">
                      View Only
                    </Badge>
                  </div>
                  <code className="block text-3xl font-mono tracking-[0.3em] text-center py-2">
                    {joinCodes.viewerJoinCode}
                  </code>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => copyCode(joinCodes.viewerJoinCode, 'Viewer')}
                    >
                      <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy Code
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => copyInviteLink(joinCodes.viewerJoinCode, 'Viewer')}
                    >
                      <Link className="h-3.5 w-3.5 mr-1.5" /> Copy Link
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="shrink-0"
                      onClick={() => handleRegenerateCode('VIEWER')}
                      disabled={regenerating === 'VIEWER'}
                    >
                      <RefreshCw className={`h-4 w-4 ${regenerating === 'VIEWER' ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Members List */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="h-5 w-5 text-muted-foreground" />
                Team Members
              </CardTitle>
              <CardDescription>
                {members.length} member{members.length !== 1 ? 's' : ''} in this workspace
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="divide-y rounded-lg border overflow-hidden">
            {members.map((member, index) => (
              <div
                key={member.id}
                className={`flex items-center justify-between p-4 transition-colors hover:bg-muted/50 ${
                  index === 0 ? '' : ''
                }`}
              >
                <div className="flex items-center gap-4">
                  <Avatar className={`h-11 w-11 ${getAvatarColor(member.user.name)}`}>
                    <AvatarFallback className="text-white font-medium">
                      {member.user.name?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-0.5">
                    <p className="font-medium leading-none">{member.user.name}</p>
                    <p className="text-sm text-muted-foreground">{member.user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {member.role === 'OWNER' ? (
                    getRoleBadge(member.role)
                  ) : isOwner ? (
                    <div className="flex items-center gap-2">
                      <Select
                        value={member.role}
                        onValueChange={(value) =>
                          updateRoleMutation.mutate({ memberId: member.id, role: value })
                        }
                      >
                        <SelectTrigger className="w-28 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="EDITOR">
                            <span className="flex items-center gap-2">
                              <Pencil className="h-3 w-3" /> Editor
                            </span>
                          </SelectItem>
                          <SelectItem value="VIEWER">
                            <span className="flex items-center gap-2">
                              <Eye className="h-3 w-3" /> Viewer
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => removeMemberMutation.mutate(member.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Remove Member
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ) : (
                    getRoleBadge(member.role)
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
