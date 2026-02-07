'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Copy, RefreshCw, Trash2, Users, Shield, Eye, Pencil } from 'lucide-react';

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

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'OWNER':
        return <Badge className="bg-amber-500"><Shield className="h-3 w-3 mr-1" /> Owner</Badge>;
      case 'EDITOR':
        return <Badge className="bg-blue-500"><Pencil className="h-3 w-3 mr-1" /> Editor</Badge>;
      case 'VIEWER':
        return <Badge variant="secondary"><Eye className="h-3 w-3 mr-1" /> Viewer</Badge>;
      default:
        return <Badge>{role}</Badge>;
    }
  };

  const currentUserId = globalThis.window ? localStorage.getItem('userId') : null;
  const isOwner = workspace?.ownerId === currentUserId;

  if (loadingMembers) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  return (
    <div className="container max-w-4xl py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Users className="h-8 w-8" />
          {workspace?.name} - Members
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage workspace members and permissions
        </p>
      </div>

      {/* Join Codes Section - Only visible to owner */}
      {joinCodes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Join Codes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Editor Code */}
              <div className="p-4 rounded-lg border bg-blue-50 dark:bg-blue-950/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium flex items-center gap-2">
                    <Pencil className="h-4 w-4" /> Editor Code
                  </span>
                  <Badge className="bg-blue-500">Can Edit</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <code className="text-2xl font-mono tracking-widest flex-1">
                    {joinCodes.editorJoinCode}
                  </code>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => copyCode(joinCodes.editorJoinCode, 'Editor')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleRegenerateCode('EDITOR')}
                    disabled={regenerating === 'EDITOR'}
                  >
                    <RefreshCw className={`h-4 w-4 ${regenerating === 'EDITOR' ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </div>

              {/* Viewer Code */}
              <div className="p-4 rounded-lg border bg-gray-50 dark:bg-gray-950/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium flex items-center gap-2">
                    <Eye className="h-4 w-4" /> Viewer Code
                  </span>
                  <Badge variant="secondary">View Only</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <code className="text-2xl font-mono tracking-widest flex-1">
                    {joinCodes.viewerJoinCode}
                  </code>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => copyCode(joinCodes.viewerJoinCode, 'Viewer')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleRegenerateCode('VIEWER')}
                    disabled={regenerating === 'VIEWER'}
                  >
                    <RefreshCw className={`h-4 w-4 ${regenerating === 'VIEWER' ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Members List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Members ({members.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 rounded-lg border"
              >
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>
                      {member.user.name?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{member.user.name}</p>
                    <p className="text-sm text-muted-foreground">{member.user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {member.role === 'OWNER' ? (
                    getRoleBadge(member.role)
                  ) : isOwner ? (
                    <>
                      <Select
                        value={member.role}
                        onValueChange={(value) =>
                          updateRoleMutation.mutate({ memberId: member.id, role: value })
                        }
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="EDITOR">Editor</SelectItem>
                          <SelectItem value="VIEWER">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => removeMemberMutation.mutate(member.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
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
  );
}
