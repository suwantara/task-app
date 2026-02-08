'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useWorkspace } from '@/contexts/workspace-context';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { useNoteRealtime } from '@/hooks/use-realtime';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
import { Plus, Save, FileText, Clock, Search, Pencil, Trash2, MoreHorizontal } from 'lucide-react';
import { SocketIOYjsProvider } from '@/lib/y-socket-io-provider';

interface Note {
  id: string;
  title: string;
  content?: string;
  icon?: string;
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
}

export default function NotesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { activeWorkspace } = useWorkspace();
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [editingContent, setEditingContent] = useState('');
  const [editingTitle, setEditingTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [noteToModify, setNoteToModify] = useState<Note | null>(null);
  const [renameTitle, setRenameTitle] = useState('');
  const [deleting, setDeleting] = useState(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editingEmitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Realtime: track who's editing which note  { noteId -> { userId -> { name, timeout } } }
  const [editingUsers, setEditingUsers] = useState<Map<string, Map<string, { userId: string; name: string; timeout: ReturnType<typeof setTimeout> }>>>(new Map());
  // Flag to ignore remote content updates when we are actively editing
  const isLocalEdit = useRef(false);
  const selectedNoteRef = useRef<string | null>(null);

  // Yjs collaborative editing temporarily disabled (TipTap reconfigure bug)
  const providerRef = useRef<SocketIOYjsProvider | null>(null);
  const [editorVersion, setEditorVersion] = useState(0);

  // Helper: get editors for a specific note
  const getEditorsForNote = useCallback((noteId: string) => {
    return editingUsers.get(noteId) || new Map();
  }, [editingUsers]);

  // Realtime hook
  const { emitNoteEditing, emitNoteStopEditing, emitContentUpdate } = useNoteRealtime(
    activeWorkspace?.id || null,
    {
      onSomeoneEditing: useCallback((data: { noteId: string; userId: string; name: string }) => {
        if (data.userId === user?.id) return;
        setEditingUsers((prev) => {
          const next = new Map(prev);
          const noteEditors = new Map(next.get(data.noteId) || new Map());
          // Clear existing timeout
          const existing = noteEditors.get(data.userId);
          if (existing?.timeout) clearTimeout(existing.timeout);
          // Auto-clear after 5s of no editing signals
          const timeout = setTimeout(() => {
            setEditingUsers((p) => {
              const n = new Map(p);
              const ne = new Map(n.get(data.noteId) || new Map());
              ne.delete(data.userId);
              if (ne.size === 0) n.delete(data.noteId);
              else n.set(data.noteId, ne);
              return n;
            });
          }, 5000);
          noteEditors.set(data.userId, { userId: data.userId, name: data.name, timeout });
          next.set(data.noteId, noteEditors);
          return next;
        });
      }, [user?.id]),
      onSomeoneStoppedEditing: useCallback((data: { noteId: string; userId: string }) => {
        setEditingUsers((prev) => {
          const next = new Map(prev);
          const noteEditors = new Map(next.get(data.noteId) || new Map());
          const existing = noteEditors.get(data.userId);
          if (existing?.timeout) clearTimeout(existing.timeout);
          noteEditors.delete(data.userId);
          if (noteEditors.size === 0) next.delete(data.noteId);
          else next.set(data.noteId, noteEditors);
          return next;
        });
      }, []),
      onContentChanged: useCallback((data: { noteId: string; title: string; content: string; userId: string }) => {
        if (data.userId === user?.id) return;
        // Only apply remote changes if we're not actively editing
        if (!isLocalEdit.current && selectedNoteRef.current === data.noteId) {
          setEditingTitle(data.title || '');
          setEditingContent(data.content || '');
        }
        // Update the note in the sidebar list
        setNotes((prev) =>
          prev.map((n) =>
            n.id === data.noteId
              ? { ...n, title: data.title || n.title, updatedAt: new Date().toISOString() }
              : n,
          ),
        );
      }, [user?.id]),
      onNoteUpdated: useCallback((note: unknown) => {
        const n = note as Note;
        setNotes((prev) =>
          prev.map((existing) => (existing.id === n.id ? { ...existing, ...n } : existing)),
        );
      }, []),
    },
  );

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, authLoading, router]);

  // Clear selected note and reload when workspace changes
  useEffect(() => {
    if (activeWorkspace) {
      setSelectedNote(null);
      setEditingContent('');
      setEditingTitle('');
      loadNotes();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkspace?.id]);

  // Cleanup: emit stop-editing on unmount and cleanup Yjs
  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      if (editingEmitTimer.current) clearTimeout(editingEmitTimer.current);
      // Cleanup Yjs provider and doc
      if (providerRef.current) {
        providerRef.current.destroy();
        providerRef.current = null;
      }
      // ydoc cleanup is handled by setYdoc in component unmount
    };
  }, []);


  // Keep selectedNoteRef in sync
  useEffect(() => {
    selectedNoteRef.current = selectedNote?.id ?? null;
  }, [selectedNote]);

  const loadNotes = async () => {
    if (!activeWorkspace) {
      setLoading(false);
      return;
    }

    try {
      const data = await apiClient.getNotes(activeWorkspace.id);
      setNotes(data);
    } catch (error) {
      console.error('Failed to load notes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNote = async (e: React.BaseSyntheticEvent) => {
    e.preventDefault();
    if (!newNoteTitle.trim() || !activeWorkspace || creating) return;
    setCreating(true);

    try {
      const newNote = await apiClient.createNote(
        activeWorkspace.id,
        newNoteTitle
      );
      setNewNoteTitle('');
      setShowCreateModal(false);
      await loadNotes();
      setSelectedNote(newNote);
      setEditingTitle(newNote.title);
      setEditingContent('');
    } catch (error) {
      console.error('Failed to create note:', error);
    } finally {
      setCreating(false);
    }
  };

  const handleSaveNote = async () => {
    if (!selectedNote) return;
    setSaving(true);

    try {
      await apiClient.updateNote(selectedNote.id, {
        title: editingTitle,
        content: editingContent,
      });
      await loadNotes();
    } catch (error) {
      console.error('Failed to save note:', error);
    } finally {
      setSaving(false);
    }
  };

  // Auto-save with debounce + realtime broadcast
  const handleContentChange = (content: string) => {
    setEditingContent(content);
    isLocalEdit.current = true;

    // Emit editing indicator (throttled)
    if (selectedNote && user) {
      if (editingEmitTimer.current) clearTimeout(editingEmitTimer.current);
      editingEmitTimer.current = setTimeout(() => {
        isLocalEdit.current = false;
      }, 3000);
      emitNoteEditing(selectedNote.id, user.id, user.name || user.email);
      emitContentUpdate(selectedNote.id, editingTitle, content, user.id);
    }

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      if (selectedNote) {
        handleSaveNote();
      }
    }, 2000);
  };

  const handleTitleChange = (title: string) => {
    setEditingTitle(title);
    isLocalEdit.current = true;

    if (selectedNote && user) {
      if (editingEmitTimer.current) clearTimeout(editingEmitTimer.current);
      editingEmitTimer.current = setTimeout(() => {
        isLocalEdit.current = false;
      }, 3000);
      emitNoteEditing(selectedNote.id, user.id, user.name || user.email);
      emitContentUpdate(selectedNote.id, title, editingContent, user.id);
    }

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      if (selectedNote) {
        handleSaveNote();
      }
    }, 2000);
  };

  const handleSelectNote = async (note: Note) => {
    // Stop editing signal for previous note
    if (selectedNote && user) {
      emitNoteStopEditing(selectedNote.id, user.id);
    }
    isLocalEdit.current = false;

    // Save current note before switching
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = null;
    }
    if (selectedNote && editingContent) {
      await apiClient.updateNote(selectedNote.id, {
        title: editingTitle,
        content: editingContent,
      }).catch(() => {});
    }

    // Cleanup previous Yjs provider
    if (providerRef.current) {
      providerRef.current.destroy();
      providerRef.current = null;
    }
    setEditorVersion((v) => v + 1);

    try {
      const fullNote = await apiClient.getNote(note.id);
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
      // Note: Yjs collaborative editing temporarily disabled (TipTap reconfigure bug)
      // Real-time sync still works via Socket.IO emitContentUpdate
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
    if (!noteToModify) return;
    setDeleting(true);
    try {
      await apiClient.deleteNote(noteToModify.id);
      setNotes((prev) => prev.filter((n) => n.id !== noteToModify.id));
      if (selectedNote?.id === noteToModify.id) {
        setSelectedNote(null);
        setEditingContent('');
        setEditingTitle('');
      }
      setShowDeleteModal(false);
      setNoteToModify(null);
    } catch (error) {
      console.error('Failed to delete note:', error);
    } finally {
      setDeleting(false);
    }
  };

  const handleRenameNote = async () => {
    if (!noteToModify || !renameTitle.trim()) return;
    try {
      const updated = await apiClient.updateNote(noteToModify.id, { title: renameTitle.trim() });
      setNotes((prev) => prev.map((n) => (n.id === noteToModify.id ? { ...n, title: updated.title } : n)));
      if (selectedNote?.id === noteToModify.id) {
        setSelectedNote((prev) => prev ? { ...prev, title: updated.title } : null);
        setEditingTitle(updated.title);
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
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-lg text-muted-foreground">Loading...</div>
      </div>
    );
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
                    {editingUsers.has(note.id) && (editingUsers.get(note.id)?.size ?? 0) > 0 && (
                      <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-blue-500 ring-1 ring-background" />
                    )}
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
                {saving && (
                  <span className="text-xs text-muted-foreground">Saving...</span>
                )}
                <Button size="sm" variant="outline" onClick={handleSaveNote}>
                  <Save className="mr-1.5 size-3.5" />
                  Save
                </Button>
              </div>
            </div>

            {/* Realtime editing indicator */}
            {selectedNote && getEditorsForNote(selectedNote.id).size > 0 && (() => {
              const editors = Array.from(getEditorsForNote(selectedNote.id).values());
              return (
                <div className="flex items-center gap-2 border-b bg-blue-50 px-6 py-1.5 dark:bg-blue-950/30">
                  <div className="flex -space-x-1.5">
                    {editors.map((eu) => (
                      <Avatar key={eu.userId} className="size-5 border-2 border-blue-50 dark:border-blue-950">
                        <AvatarFallback className="bg-blue-500 text-[10px] text-white">
                          {(eu.name ?? '?').charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Pencil className="size-3 animate-pulse text-blue-500" />
                    <span className="text-xs text-blue-600 dark:text-blue-400">
                      {editors.map((eu) => (eu.name ?? 'Unknown').split('@')[0]).join(', ')}{' '}
                      {editors.length === 1 ? 'is' : 'are'} editing...
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Rich Text Editor - Yjs collaboration temporarily disabled */}
            <div className="flex-1 overflow-hidden">
              <SimpleEditor
                key={`editor-${selectedNote?.id}-${editorVersion}`}
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
              <Button type="submit" disabled={creating}>Create</Button>
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
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
