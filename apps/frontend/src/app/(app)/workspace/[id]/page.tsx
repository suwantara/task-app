'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ShareDialog } from '@/components/share-dialog';
import { WorkspaceMembers } from '@/components/workspace-members';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Share2 } from 'lucide-react';

interface WorkspaceMember {
  id: string;
  userId: string;
  role: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
  };
}

interface Board {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
}

interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  members?: WorkspaceMember[];
}

export default function WorkspacePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const workspaceId = params.id as string;

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [newBoardDescription, setNewBoardDescription] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, authLoading, router]);

  const loadWorkspaceData = async () => {
    try {
      const [workspaceData, boardsData, membersData] = await Promise.all([
        apiClient.getWorkspace(workspaceId),
        apiClient.getBoards(workspaceId),
        apiClient.getWorkspaceMembers(workspaceId).catch(() => []),
      ]);
      setWorkspace({ ...workspaceData, members: membersData } as Workspace);
      setBoards(boardsData);
    } catch (error) {
      console.error('Failed to load workspace data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && workspaceId) {
      loadWorkspaceData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, workspaceId]);

  const handleCreateBoard = async (e: React.BaseSyntheticEvent) => {
    e.preventDefault();
    if (!newBoardName.trim()) return;

    try {
      await apiClient.createBoard(workspaceId, newBoardName, newBoardDescription);
      setNewBoardName('');
      setNewBoardDescription('');
      setShowCreateModal(false);
      loadWorkspaceData();
    } catch (error) {
      console.error('Failed to create board:', error);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-lg text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">{workspace?.name} — Boards</h1>
        <div className="flex items-center gap-3">
          {workspace?.members && workspace.members.length > 0 && (
            <WorkspaceMembers members={workspace.members} maxVisible={5} size="md" />
          )}
          <Button variant="outline" size="sm" onClick={() => setShareOpen(true)}>
            <Share2 className="mr-2 h-4 w-4" />
            Share
          </Button>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Board
          </Button>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {boards.map((board) => (
          <Link key={board.id} href={`/board/${board.id}`}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <CardTitle>{board.name}</CardTitle>
                {board.description && (
                  <CardDescription>{board.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Created {new Date(board.createdAt).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}

        {boards.length === 0 && (
          <div className="col-span-full text-center py-12">
            <p className="text-muted-foreground">
              No boards yet. Create your first board to get started!
            </p>
          </div>
        )}
      </div>

      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Board</DialogTitle>
            <DialogDescription>
              Add a new board to organize your tasks.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateBoard}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Board Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Development Sprint"
                  value={newBoardName}
                  onChange={(e) => setNewBoardName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  placeholder="What is this board for?"
                  rows={3}
                  value={newBoardDescription}
                  onChange={(e) => setNewBoardDescription(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowCreateModal(false);
                  setNewBoardName('');
                  setNewBoardDescription('');
                }}
              >
                Cancel
              </Button>
              <Button type="submit">Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {workspace && (
        <ShareDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          workspaceId={workspaceId}
          workspaceName={workspace.name}
          currentUserId={user?.id || ''}
          isOwner={workspace.ownerId === user?.id}
        />
      )}
    </div>
  );
}
