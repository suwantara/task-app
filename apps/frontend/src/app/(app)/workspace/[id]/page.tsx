'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthGuard } from '@/hooks/use-auth-guard';
import { PageLoading } from '@/components/page-loading';
import { useWorkspace, useBoards, useWorkspaceMembers, useCreateBoard, useUpdateBoard, useDeleteBoard } from '@/hooks/use-queries';
import type { Workspace, WorkspaceMember, Board } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Share2, MoreHorizontal, Pencil, Trash2, Kanban } from 'lucide-react';

interface WorkspaceWithMembers extends Omit<Workspace, 'members'> {
  members?: WorkspaceMember[];
}

export default function WorkspacePage() {
  const { user, loading: authLoading } = useAuthGuard();
  const params = useParams();
  const workspaceId = params.id as string;

  // React Query
  const { data: workspaceData, isLoading: wsLoading } = useWorkspace(workspaceId);
  const { data: boards = [], isLoading: boardsLoading } = useBoards(workspaceId);
  const { data: membersData = [] } = useWorkspaceMembers(workspaceId);
  const createBoardMutation = useCreateBoard();
  const updateBoardMutation = useUpdateBoard();
  const deleteBoardMutation = useDeleteBoard();

  const workspace = workspaceData ? { ...workspaceData, members: membersData } as WorkspaceWithMembers : null;
  const loading = wsLoading || boardsLoading;

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [newBoardDescription, setNewBoardDescription] = useState('');

  // Rename
  const [renamingBoard, setRenamingBoard] = useState<Board | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Delete
  const [deletingBoard, setDeletingBoard] = useState<Board | null>(null);

  // Helper to check if current user is owner (with fallback to members array)
  const isCurrentUserOwner = (ws: WorkspaceWithMembers | null) => {
    if (!ws || !user?.id) return false;
    // Primary check: ownerId field
    if (ws.ownerId === user.id) return true;
    // Fallback: check members array for OWNER role
    const currentMember = ws.members?.find(m => m.userId === user.id);
    return currentMember?.role === 'OWNER';
  };


  const handleCreateBoard = async (e: React.BaseSyntheticEvent) => {
    e.preventDefault();
    if (!newBoardName.trim() || createBoardMutation.isPending) return;

    try {
      await createBoardMutation.mutateAsync({ workspaceId, name: newBoardName, description: newBoardDescription });
      setNewBoardName('');
      setNewBoardDescription('');
      setShowCreateModal(false);
    } catch (error) {
      console.error('Failed to create board:', error);
    }
  };

  const handleRenameBoard = async () => {
    if (!renamingBoard || !renameValue.trim()) return;
    try {
      await updateBoardMutation.mutateAsync({ id: renamingBoard.id, workspaceId, name: renameValue });
      setRenamingBoard(null);
    } catch (error) {
      console.error('Failed to rename board:', error);
    }
  };

  const handleDeleteBoard = async () => {
    if (!deletingBoard) return;
    try {
      await deleteBoardMutation.mutateAsync({ id: deletingBoard.id, workspaceId });
      setDeletingBoard(null);
    } catch (error) {
      console.error('Failed to delete board:', error);
    }
  };

  if (authLoading || loading) {
    return <PageLoading />;
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {boards.map((board) => (
          <Card
            key={board.id}
            className="group relative cursor-pointer p-3 transition-shadow hover:shadow-md"
          >
            <Link href={`/board/${board.id}`} className="block">
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Kanban className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1 pr-6">
                  <CardTitle className="text-sm leading-tight line-clamp-1">
                    {board.name}
                  </CardTitle>
                  {board.description && (
                    <CardDescription className="mt-1 text-xs line-clamp-2">
                      {board.description}
                    </CardDescription>
                  )}
                  <p className="mt-1.5 text-[10px] text-muted-foreground">
                    {new Date(board.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </Link>
            {/* Dropdown menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="absolute right-2 top-2 rounded-md p-1 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
                  onClick={(e) => e.preventDefault()}
                >
                  <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem
                  onClick={() => {
                    setRenamingBoard(board);
                    setRenameValue(board.name);
                  }}
                >
                  <Pencil className="mr-2 h-3.5 w-3.5" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setDeletingBoard(board)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </Card>
        ))}

        {boards.length === 0 && (
          <div className="col-span-full py-12 text-center">
            <p className="text-muted-foreground">
              No boards yet. Create your first board to get started!
            </p>
          </div>
        )}
      </div>

      {/* Create Board Dialog */}
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
              <Button type="submit" disabled={createBoardMutation.isPending}>Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Rename Board Dialog */}
      <Dialog open={!!renamingBoard} onOpenChange={(open) => !open && setRenamingBoard(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Board</DialogTitle>
            <DialogDescription>Enter a new name for this board.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleRenameBoard();
            }}
          >
            <div className="py-4">
              <Input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                placeholder="Board name"
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRenamingBoard(null)}>
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Board Confirmation */}
      <AlertDialog open={!!deletingBoard} onOpenChange={(open) => !open && setDeletingBoard(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Board</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deletingBoard?.name}&quot;? This will permanently remove all columns and tasks in this board. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteBoard}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {workspace && (
        <ShareDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          workspaceId={workspaceId}
          workspaceName={workspace.name}
          currentUserId={user?.id || ''}
          isOwner={isCurrentUserOwner(workspace)}
        />
      )}
    </div>
  );
}
