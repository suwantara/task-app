'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuthGuard } from '@/hooks/use-auth-guard';
import { useWorkspace } from '@/contexts/workspace-context';
import { apiClient } from '@/lib/api';
import type { Note } from '@/lib/api';
import { PageLoading } from '@/components/page-loading';
import { useNotes, useCreateNote, useUpdateNote, useDeleteNote, queryKeys } from '@/hooks/use-queries';
import { useQueryClient } from '@tanstack/react-query';
import { useNoteRealtime } from '@/hooks/use-realtime';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import { SimpleEditor } from '@/components/tiptap-templates/simple/simple-editor';
import { Plus, FileText, Clock, Search, Pencil, Trash2, MoreHorizontal, Check, Loader2, PenLine, RefreshCw } from 'lucide-react';

export default function NotesPage() {
  const { user, loading: authLoading } = useAuthGuard();
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id || '';
  const qc = useQueryClient();

  // React Query: notes list & mutations
  const { data: notes = [], isLoading: loading } = useNotes(workspaceId);
  const createNoteMutation = useCreateNote();
  const updateNoteMutation = useUpdateNote();
  const deleteNoteMutation = useDeleteNote();

  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [editingContent, setEditingContent] = useState('');
  const [editingTitle, setEditingTitle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [noteToModify, setNoteToModify] = useState<Note | null>(null);
  const [renameTitle, setRenameTitle] = useState('');

  // Typing indicator from other users
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
  const typingTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Autosave state
  const AUTOSAVE_INTERVAL = 2000; // 2 seconds
  const [saveStatus, setSaveStatus] = useState<'idle' | 'unsaved' | 'saving' | 'saved'>('idle');
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasPendingChanges = useRef(false);

  // Flag to ignore remote content updates when we are actively editing
  const isLocalEdit = useRef(false);
  const selectedNoteRef = useRef<string | null>(null);

  // Refs to always have the latest editing values (avoids stale closures in timers)
  const editingContentRef = useRef(editingContent);
  editingContentRef.current = editingContent;
  const editingTitleRef = useRef(editingTitle);
  editingTitleRef.current = editingTitle;

  // Ref for emitStopTyping to avoid stale closure in handleSaveNote
  const emitStopTypingRef = useRef<(noteId: string, userId: string) => void>(() => {});

  // Realtime hook — update React Query cache on remote changes
  const { emitTyping, emitStopTyping } = useNoteRealtime(
    activeWorkspace?.id || null,
    {
      onNoteCreated: useCallback((note: unknown) => {
        const n = note as Note;
        if (workspaceId) {
          qc.setQueryData(queryKeys.notes(workspaceId), (old: Note[] | undefined) =>
            old ? [n, ...old] : [n],
          );
        }
      // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [workspaceId]),

      onNoteUpdated: useCallback((note: unknown) => {
        const n = note as Note;
        if (workspaceId) {
          qc.setQueryData(queryKeys.notes(workspaceId), (old: Note[] | undefined) =>
            old ? old.map((existing) => (existing.id === n.id ? { ...existing, ...n } : existing)) : old,
          );
        }
        
        // Update current note if selected and not currently being edited locally
        if (selectedNoteRef.current === n.id && !isLocalEdit.current) {
          setSelectedNote((prev) => prev ? { ...prev, ...n } : null);
          setEditingTitle(n.title);
          const content = typeof n.content === 'string' 
            ? n.content 
            : JSON.stringify(n.content ?? '', null, 2);
          setEditingContent(content);
        }
      // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [workspaceId]),

      onNoteDeleted: useCallback((data: { id: string }) => {
        if (workspaceId) {
          qc.setQueryData(queryKeys.notes(workspaceId), (old: Note[] | undefined) =>
            old ? old.filter((n) => n.id !== data.id) : old,
          );
        }
        if (selectedNoteRef.current === data.id) {
          setSelectedNote(null);
          setEditingContent('');
          setEditingTitle('');
        }
      // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [workspaceId]),

      // Typing indicator: someone else is typing on a note
      onNoteTyping: useCallback((data: { noteId: string; userId: string; name: string }) => {
        setTypingUsers((prev) => {
          const next = new Map(prev);
          next.set(data.userId, data.name);
          return next;
        });
        // Auto-clear after 3s if no new typing event
        const existing = typingTimers.current.get(data.userId);
        if (existing) clearTimeout(existing);
        typingTimers.current.set(
          data.userId,
          setTimeout(() => {
            setTypingUsers((prev) => {
              const next = new Map(prev);
              next.delete(data.userId);
              return next;
            });
            typingTimers.current.delete(data.userId);
          }, 3000),
        );
      }, []),

      onNoteStopTyping: useCallback((data: { noteId: string; userId: string }) => {
        setTypingUsers((prev) => {
          const next = new Map(prev);
          next.delete(data.userId);
          return next;
        });
        const timer = typingTimers.current.get(data.userId);
        if (timer) {
          clearTimeout(timer);
          typingTimers.current.delete(data.userId);
        }
      }, []),
    },
  );

  // Keep emitStopTyping ref in sync
  emitStopTypingRef.current = emitStopTyping;

  // Clear selected note when workspace changes
  useEffect(() => {
    if (activeWorkspace) {
      setSelectedNote(null);
      setEditingContent('');
      setEditingTitle('');
    }
  }, [activeWorkspace?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup
  useEffect(() => {
    const timers = typingTimers.current;
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      for (const timer of timers.values()) clearTimeout(timer);
    };
  }, []);


  // Keep selectedNoteRef in sync
  useEffect(() => {
    selectedNoteRef.current = selectedNote?.id ?? null;
  }, [selectedNote]);

  const handleCreateNote = async (e: React.BaseSyntheticEvent) => {
    e.preventDefault();
    if (!newNoteTitle.trim() || !activeWorkspace || createNoteMutation.isPending) return;

    try {
      const newNote = await createNoteMutation.mutateAsync({
        workspaceId: activeWorkspace.id,
        title: newNoteTitle,
      });
      setNewNoteTitle('');
      setShowCreateModal(false);
      setSelectedNote(newNote as Note);
      setEditingTitle((newNote as Note).title);
      setEditingContent('');
      setSaveStatus('idle');
    } catch (error) {
      console.error('Failed to create note:', error);
    }
  };

  // Save note using React Query mutation (reads latest values from refs to avoid stale closures)
  const handleSaveNote = useCallback(async () => {
    if (!selectedNoteRef.current || !workspaceId) return;
    const noteId = selectedNoteRef.current;
    setSaveStatus('saving');
    isLocalEdit.current = false;
    hasPendingChanges.current = false;

    try {
      await updateNoteMutation.mutateAsync({
        id: noteId,
        workspaceId,
        title: editingTitleRef.current,
        content: editingContentRef.current,
      });
      setSaveStatus('saved');
      // Notify others that typing stopped (content is now persisted & broadcast via server)
      if (user) {
        emitStopTypingRef.current(noteId, user.id);
      }
      // Reset to idle after 2s
      setTimeout(() => setSaveStatus((s) => s === 'saved' ? 'idle' : s), 2000);
    } catch (error) {
      console.error('Failed to save note:', error);
      setSaveStatus('unsaved');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, user]);

  // Schedule autosave with configurable interval
  const scheduleAutosave = useCallback(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    hasPendingChanges.current = true;
    setSaveStatus('unsaved');
    autoSaveTimer.current = setTimeout(() => {
      handleSaveNote();
    }, AUTOSAVE_INTERVAL);
  }, [handleSaveNote]);

  // Auto-save with configurable interval
  const handleContentChange = (content: string) => {
    setEditingContent(content);
    isLocalEdit.current = true;
    // Emit typing status (no content) so other users see a typing indicator
    if (selectedNoteRef.current && user) {
      emitTyping(selectedNoteRef.current, user.id, user.name);
    }
    scheduleAutosave();
  };

  const handleTitleChange = (title: string) => {
    setEditingTitle(title);
    isLocalEdit.current = true;
    if (selectedNoteRef.current && user) {
      emitTyping(selectedNoteRef.current, user.id, user.name);
    }
    scheduleAutosave();
  };

  const handleSelectNote = async (note: Note) => {
    // Stop typing indicator for previous note
    if (selectedNoteRef.current && user) {
      emitStopTyping(selectedNoteRef.current, user.id);
    }
    isLocalEdit.current = false;

    // Flush pending save for current note before switching
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = null;
    }
    if (selectedNote && hasPendingChanges.current) {
      await updateNoteMutation.mutateAsync({
        id: selectedNote.id,
        workspaceId,
        title: editingTitleRef.current,
        content: editingContentRef.current,
      }).catch(() => {});
      hasPendingChanges.current = false;
    }

    try {
      // Use React Query queryClient.fetchQuery for caching
      const fullNote = await qc.fetchQuery({
        queryKey: queryKeys.note(note.id),
        queryFn: () => apiClient.getNote(note.id),
        staleTime: 30_000,
      });
      setSelectedNote(fullNote);
      setEditingTitle(fullNote.title);
      let contentStr = '';
      if (fullNote.content) {
        contentStr =
          typeof fullNote.content === 'string'
            ? fullNote.content
            : JSON.stringify(fullNote.content, null, 2);
      }
      setEditingContent(contentStr);
      setSaveStatus('idle');
    } catch (error) {
      console.error('Failed to load note:', error);
    }
  };

  const filteredNotes = searchQuery
    ? notes.filter((n) =>
        n.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : notes;

  const handleDeleteNote = async () => {
    if (!noteToModify || !workspaceId) return;
    try {
      await deleteNoteMutation.mutateAsync({ id: noteToModify.id, workspaceId });
      if (selectedNote?.id === noteToModify.id) {
        setSelectedNote(null);
        setEditingContent('');
        setEditingTitle('');
      }
      setShowDeleteModal(false);
      setNoteToModify(null);
    } catch (error) {
      console.error('Failed to delete note:', error);
    }
  };

  const handleRenameNote = async () => {
    if (!noteToModify || !renameTitle.trim() || !workspaceId) return;
    try {
      const updated = await updateNoteMutation.mutateAsync({
        id: noteToModify.id,
        workspaceId,
        title: renameTitle.trim(),
      });
      if (selectedNote?.id === noteToModify.id) {
        setSelectedNote((prev) => prev ? { ...prev, title: (updated as Note).title } : null);
        setEditingTitle((updated as Note).title);
      }
      setShowRenameModal(false);
      setNoteToModify(null);
      setRenameTitle('');
    } catch (error) {
      console.error('Failed to rename note:', error);
    }
  };

  const openRenameModal = (note: Note, e: React.MouseEvent) => {
    e.stopPropagation();
    setNoteToModify(note);
    setRenameTitle(note.title);
    setShowRenameModal(true);
  };

  const openDeleteModal = (note: Note, e: React.MouseEvent) => {
    e.stopPropagation();
    setNoteToModify(note);
    setShowDeleteModal(true);
  };


  if (authLoading || loading) {
    return <PageLoading />;
  }

  return (
    <div className="flex h-[calc(100vh-3rem)]">
      {/* Sidebar - Note List */}
      <div className="flex w-72 shrink-0 flex-col border-r">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Notes</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground truncate max-w-24">
              {activeWorkspace?.name || 'No workspace'}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => qc.invalidateQueries({ queryKey: queryKeys.notes(workspaceId) })}
              title="Refresh notes"
            >
              <RefreshCw className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus className="size-4" />
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="px-3 py-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>
        </div>

        {/* Note List */}
        <ScrollArea className="flex-1">
          <div className="space-y-0.5 px-2 py-1">
            {filteredNotes.map((note) => (
              <div
                key={note.id}
                className={`group relative flex w-full items-start gap-2.5 rounded-md px-3 py-2.5 text-left transition-colors ${
                  selectedNote?.id === note.id
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-muted/50 text-foreground'
                }`}
              >
                <button
                  onClick={() => handleSelectNote(note)}
                  className="flex flex-1 items-start gap-2.5"
                >
                  <div className="relative mt-0.5">
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{note.title}</p>
                    <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Clock className="size-3" />
                      {new Date(note.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="mt-0.5 rounded p-0.5 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100 focus:opacity-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="size-4 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-32">
                    <DropdownMenuItem onClick={(e) => openRenameModal(note, e)}>
                      <Pencil className="mr-2 size-3.5" />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={(e) => openDeleteModal(note, e)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 size-3.5" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}

            {filteredNotes.length === 0 && (
              <p className="py-8 text-center text-xs text-muted-foreground">
                {searchQuery ? 'No notes found.' : 'No notes yet.'}
              </p>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Editor Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {selectedNote ? (
          <>
            {/* Title bar */}
            <div className="flex items-center justify-between border-b px-6 py-3">
              <input
                type="text"
                value={editingTitle}
                onChange={(e) => handleTitleChange(e.target.value)}
                className="w-full bg-transparent text-2xl font-bold outline-none placeholder:text-muted-foreground"
                placeholder="Untitled"
              />
              <div className="flex items-center gap-2 shrink-0 ml-4">
                {saveStatus === 'saving' && (
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" />
                    Saving
                  </span>
                )}
                {saveStatus === 'saved' && (
                  <span className="flex items-center gap-1 text-xs text-green-600">
                    <Check className="size-3.5" />
                    Saved
                  </span>
                )}
                {saveStatus === 'unsaved' && (
                  <span className="flex items-center gap-1.5 text-xs text-amber-500">
                    <Loader2 className="size-3.5 animate-spin" />
                    Editing
                  </span>
                )}
                {typingUsers.size > 0 && (
                  <span className="flex items-center gap-1.5 text-xs text-blue-500">
                    <PenLine className="size-3.5" />
                    {[...typingUsers.values()].join(', ')} typing…
                  </span>
                )}
              </div>
            </div>



            {/* Rich Text Editor */}
            <div className="flex-1 overflow-hidden">
              <SimpleEditor
                key={`editor-${selectedNote?.id}`}
                content={editingContent}
                onChange={handleContentChange}
                placeholder="Start writing..."
              />
            </div>

          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-muted-foreground">
            <FileText className="size-12 opacity-30" />
            <div className="text-center">
              <p className="text-sm font-medium">No note selected</p>
              <p className="mt-1 text-xs">
                Select a note from the sidebar or create a new one
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus className="mr-2 size-4" />
              New Note
            </Button>
          </div>
        )}
      </div>

      {/* Create Note Dialog */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Note</DialogTitle>
            <DialogDescription>
              Add a new note to your workspace.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateNote}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="note-title">Title</Label>
                <Input
                  id="note-title"
                  placeholder="Note title"
                  value={newNoteTitle}
                  onChange={(e) => setNewNoteTitle(e.target.value)}
                  autoFocus
                  autoComplete="off"
                  data-1p-ignore
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowCreateModal(false);
                  setNewNoteTitle('');
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createNoteMutation.isPending}>Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Rename Note Modal */}
      <Dialog open={showRenameModal} onOpenChange={setShowRenameModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename Note</DialogTitle>
            <DialogDescription>
              Enter a new name for this note.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleRenameNote(); }}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="rename-title">Title</Label>
                <Input
                  id="rename-title"
                  placeholder="Note title"
                  value={renameTitle}
                  onChange={(e) => setRenameTitle(e.target.value)}
                  autoFocus
                  autoComplete="off"
                  data-1p-ignore
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowRenameModal(false);
                  setNoteToModify(null);
                  setRenameTitle('');
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!renameTitle.trim()}>
                Rename
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Note Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Note</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{noteToModify?.title}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowDeleteModal(false);
                setNoteToModify(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteNote}
              disabled={deleteNoteMutation.isPending}
            >
              {deleteNoteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
