'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { apiClient } from '@/lib/api';
import { ShareDialog } from '@/components/share-dialog';
import { WorkspaceMembers } from '@/components/workspace-members';
import { Input } from '@/components/ui/input';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  LayoutDashboard,
  Kanban,
  StickyNote,
  Table2,
  Plus,
  LogOut,
  ChevronsUpDown,
  Settings,
  Layers,
  Share2,
  MoreHorizontal,
  Pencil,
  Trash2,
  Star,
} from 'lucide-react';

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

interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  members?: WorkspaceMember[];
}

interface Board {
  id: string;
  name: string;
  workspaceId: string;
}

export function AppSidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { state } = useSidebar();

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [shareOpen, setShareOpen] = useState(false);
  const [renamingBoard, setRenamingBoard] = useState<Board | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deletingBoard, setDeletingBoard] = useState<Board | null>(null);

  const loadWorkspaces = useCallback(async () => {
    try {
      const data = await apiClient.getWorkspaces();
      setWorkspaces(data as Workspace[]);
      if (data.length > 0 && !activeWorkspace) {
        setActiveWorkspace(data[0] as Workspace);
      }
    } catch (error) {
      console.error('Failed to load workspaces:', error);
    }
  }, [activeWorkspace]);

  const loadBoards = useCallback(async () => {
    if (!activeWorkspace) return;
    try {
      const data = await apiClient.getBoards(activeWorkspace.id);
      setBoards(data);
    } catch (error) {
      console.error('Failed to load boards:', error);
    }
  }, [activeWorkspace]);

  useEffect(() => {
    if (user) { loadWorkspaces(); }
  }, [user, loadWorkspaces]);

  useEffect(() => {
    if (activeWorkspace) { loadBoards(); }
  }, [activeWorkspace, loadBoards]);

  const handleRenameBoard = async () => {
    if (!renamingBoard || !renameValue.trim()) return;
    try {
      await apiClient.updateBoard(renamingBoard.id, { name: renameValue });
      setRenamingBoard(null);
      loadBoards();
    } catch (error) {
      console.error('Failed to rename board:', error);
    }
  };

  const handleDeleteBoard = async () => {
    if (!deletingBoard) return;
    try {
      await apiClient.deleteBoard(deletingBoard.id);
      setDeletingBoard(null);
      // If the deleted board is currently open, navigate to workspace
      if (pathname.startsWith(`/board/${deletingBoard.id}`)) {
        router.push(activeWorkspace ? `/workspace/${activeWorkspace.id}` : '/dashboard');
      }
      loadBoards();
    } catch (error) {
      console.error('Failed to delete board:', error);
    }
  };

  const isActive = (path: string) => pathname === path;
  const isActivePrefix = (prefix: string) => pathname.startsWith(prefix);

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent"
                >
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <Layers className="size-4" />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">
                      {activeWorkspace?.name || 'Select Workspace'}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {workspaces.length} workspace{workspaces.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56"
                align="start"
                side={state === 'collapsed' ? 'right' : 'bottom'}
                sideOffset={4}
              >
                {workspaces.map((ws) => (
                  <DropdownMenuItem
                    key={ws.id}
                    onClick={() => setActiveWorkspace(ws)}
                    className={
                      activeWorkspace?.id === ws.id ? 'bg-accent' : ''
                    }
                  >
                    <div className="flex aspect-square size-6 items-center justify-center rounded-sm bg-muted text-muted-foreground">
                      <Layers className="size-3" />
                    </div>
                    <span className="ml-2">{ws.name}</span>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => router.push('/dashboard')}
                >
                  <Plus className="mr-2 size-4" />
                  Manage Workspaces
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive('/dashboard')}
                  tooltip="Dashboard"
                >
                  <Link href="/dashboard">
                    <LayoutDashboard />
                    <span>Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive('/tasks')}
                  tooltip="Table View"
                >
                  <Link href="/tasks">
                    <Table2 />
                    <span>Table View</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive('/notes')}
                  tooltip="Notes"
                >
                  <Link href="/notes">
                    <StickyNote />
                    <span>Notes</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <Separator />

        {/* Boards */}
        <SidebarGroup>
          <SidebarGroupLabel>Boards</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {boards.map((board) => (
                <SidebarMenuItem key={board.id}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActivePrefix(`/board/${board.id}`)}
                    tooltip={board.name}
                  >
                    <Link href={`/board/${board.id}`}>
                      <Kanban />
                      <span>{board.name}</span>
                    </Link>
                  </SidebarMenuButton>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <SidebarMenuAction showOnHover>
                        <MoreHorizontal />
                        <span className="sr-only">More</span>
                      </SidebarMenuAction>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="right" align="start" className="w-40">
                      <DropdownMenuItem onClick={() => {
                        setRenamingBoard(board);
                        setRenameValue(board.name);
                      }}>
                        <Pencil className="mr-2 size-3.5" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Star className="mr-2 size-3.5" />
                        Star
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setDeletingBoard(board)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 size-3.5" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </SidebarMenuItem>
              ))}

              {boards.length === 0 && (
                <SidebarMenuItem>
                  <SidebarMenuButton disabled className="text-muted-foreground">
                    <span className="text-xs">No boards yet</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              {activeWorkspace && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    tooltip="View All Boards"
                    className="text-muted-foreground"
                  >
                    <Link href={`/workspace/${activeWorkspace.id}`}>
                      <Plus />
                      <span>Add / View All</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <Separator />

        {/* Workspace Members */}
        {activeWorkspace?.members && activeWorkspace.members.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>
              <span className="flex-1">Members</span>
              <button
                onClick={() => setShareOpen(true)}
                className="ml-auto rounded-md p-0.5 hover:bg-muted"
              >
                <Share2 className="size-3.5" />
              </button>
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="px-2 py-1">
                <WorkspaceMembers members={activeWorkspace.members} maxVisible={6} />
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent"
                >
                  <Avatar className="size-8">
                    <AvatarFallback className="text-xs">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">{user?.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {user?.email}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-48"
                align="start"
                side={state === 'collapsed' ? 'right' : 'top'}
                sideOffset={4}
              >
                <DropdownMenuItem onClick={() => router.push('/settings')}>
                  <Settings className="mr-2 size-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout}>
                  <LogOut className="mr-2 size-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />

      {activeWorkspace && (
        <ShareDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          workspaceId={activeWorkspace.id}
          workspaceName={activeWorkspace.name}
          currentUserId={user?.id || ''}
          isOwner={activeWorkspace.ownerId === user?.id}
        />
      )}

      {/* Rename Board Dialog */}
      <Dialog open={!!renamingBoard} onOpenChange={(open) => !open && setRenamingBoard(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Board</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleRenameBoard(); }}>
            <div className="py-4">
              <Input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                placeholder="Board name"
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRenamingBoard(null)}>Cancel</Button>
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
              Are you sure you want to delete &quot;{deletingBoard?.name}&quot;? All columns and tasks will be permanently removed.
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
    </Sidebar>
  );
}
