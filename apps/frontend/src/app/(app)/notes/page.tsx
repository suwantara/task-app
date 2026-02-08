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

  // Flag to ignore remote content updates when we are actively editing
  const isLocalEdit = useRef(false);
  const selectedNoteRef = useRef<string | null>(null);

  // Realtime hook
  useNoteRealtime(
    activeWorkspace?.id || null,
    {
      onNoteUpdated: useCallback((note: unknown) => {
        const n = note as Note;
        // Update list
        setNotes((prev) =>
          prev.map((existing) => (existing.id === n.id ? { ...existing, ...n } : existing)),
        );
        
        // Update current note if selected and not currently being edited locally
        if (selectedNoteRef.current === n.id && !isLocalEdit.current) {
          setSelectedNote((prev) => prev ? { ...prev, ...n } : null);
          setEditingTitle(n.title);
          const content = typeof n.content === 'string' 
            ? n.content 
            : JSON.stringify(n.content || '', null, 2);
          setEditingContent(content);
        }
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

  // Cleanup
  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
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
    if (!selectedNote || !user) return;
    setSaving(true);
    isLocalEdit.current = false; // Allow remote updates after save

    try {
      await apiClient.updateNote(selectedNote.id, {
        title: editingTitle,
        content: editingContent,
      });
      // No manual emit - backend broadcasts note:updated
      
      await loadNotes();
    } catch (error) {
      console.error('Failed to save note:', error);
    } finally {
      setSaving(false);
    }
  };

  // Auto-save with debounce + realtime broadcast
  // Auto-save with debounce
  const handleContentChange = (content: string) => {
    setEditingContent(content);
    isLocalEdit.current = true;

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

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      if (selectedNote) {
        handleSaveNote();
      }
    }, 2000);
  };

  const handleSelectNote = async (note: Note) => {
    // Stop editing signal for previous note
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
