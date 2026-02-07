'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SimpleEditor } from '@/components/tiptap-templates/simple/simple-editor';
import { Plus, Save, FileText, Clock, Search } from 'lucide-react';

interface Note {
  id: string;
  title: string;
  content?: string;
  icon?: string;
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
}

interface Workspace {
  id: string;
  name: string;
}

export default function NotesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('');
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
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      loadWorkspaces();
    }
  }, [user]);

  useEffect(() => {
    if (selectedWorkspaceId) {
      loadNotes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWorkspaceId]);

  const loadWorkspaces = async () => {
    try {
      const data = await apiClient.getWorkspaces();
      setWorkspaces(data);
      if (data.length > 0) {
        setSelectedWorkspaceId(data[0].id);
      }
    } catch (error) {
      console.error('Failed to load workspaces:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadNotes = async () => {
    if (!selectedWorkspaceId) return;

    try {
      const data = await apiClient.getNotes(selectedWorkspaceId);
      setNotes(data);
    } catch (error) {
      console.error('Failed to load notes:', error);
    }
  };

  const handleCreateNote = async (e: React.BaseSyntheticEvent) => {
    e.preventDefault();
    if (!newNoteTitle.trim() || !selectedWorkspaceId || creating) return;
    setCreating(true);

    try {
      const newNote = await apiClient.createNote(
        selectedWorkspaceId,
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

  // Auto-save with debounce
  const handleContentChange = (content: string) => {
    setEditingContent(content);
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      if (selectedNote) {
        handleSaveNote();
      }
    }, 2000);
  };

  const handleTitleChange = (title: string) => {
    setEditingTitle(title);
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      if (selectedNote) {
        handleSaveNote();
      }
    }, 2000);
  };

  const handleSelectNote = async (note: Note) => {
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
    } catch (error) {
      console.error('Failed to load note:', error);
    }
  };

  const filteredNotes = searchQuery
    ? notes.filter((n) =>
        n.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : notes;

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
          <div className="flex items-center gap-1">
            <Select
              value={selectedWorkspaceId}
              onValueChange={setSelectedWorkspaceId}
            >
              <SelectTrigger className="h-7 w-28 text-xs">
                <SelectValue placeholder="Workspace" />
              </SelectTrigger>
              <SelectContent>
                {workspaces.map((workspace) => (
                  <SelectItem key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              <button
                key={note.id}
                onClick={() => handleSelectNote(note)}
                className={`flex w-full items-start gap-2.5 rounded-md px-3 py-2.5 text-left transition-colors ${
                  selectedNote?.id === note.id
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-muted/50 text-foreground'
                }`}
              >
                <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{note.title}</p>
                  <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Clock className="size-3" />
                    {new Date(note.updatedAt).toLocaleDateString()}
                  </div>
                </div>
              </button>
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
    </div>
  );
}
