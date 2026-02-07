'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api';

interface Note {
  id: string;
  title: string;
  content?: any;
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

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteTitle.trim() || !selectedWorkspaceId) return;

    try {
      const newNote = await apiClient.createNote(
        selectedWorkspaceId,
        newNoteTitle
      );
      setNewNoteTitle('');
      setShowCreateModal(false);
      loadNotes();
      setSelectedNote(newNote);
      setEditingContent('');
    } catch (error) {
      console.error('Failed to create note:', error);
    }
  };

  const handleSaveNote = async () => {
    if (!selectedNote) return;

    try {
      await apiClient.updateNote(selectedNote.id, {
        content: editingContent,
      });
      loadNotes();
    } catch (error) {
      console.error('Failed to save note:', error);
    }
  };

  const handleSelectNote = async (note: Note) => {
    try {
      const fullNote = await apiClient.getNote(note.id);
      setSelectedNote(fullNote);
      setEditingContent(
        typeof fullNote.content === 'string'
          ? fullNote.content
          : fullNote.content
          ? JSON.stringify(fullNote.content, null, 2)
          : ''
      );
    } catch (error) {
      console.error('Failed to load note:', error);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
              ← Back to Dashboard
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Notes</h1>
          </div>
          <div className="flex items-center gap-4">
            <select
              className="rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              value={selectedWorkspaceId}
              onChange={(e) => setSelectedWorkspaceId(e.target.value)}
            >
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowCreateModal(true)}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
            >
              New Note
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-12 gap-6">
          {/* Notes List */}
          <div className="col-span-3 space-y-2">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              All Notes
            </h2>
            {notes.map((note) => (
              <button
                key={note.id}
                onClick={() => handleSelectNote(note)}
                className={`w-full rounded-lg p-4 text-left transition-colors ${
                  selectedNote?.id === note.id
                    ? 'bg-blue-50 border-2 border-blue-500'
                    : 'bg-white hover:bg-gray-50 border border-gray-200'
                }`}
              >
                <h3 className="font-medium text-gray-900">{note.title}</h3>
                <p className="mt-1 text-xs text-gray-500">
                  {new Date(note.updatedAt).toLocaleDateString()}
                </p>
              </button>
            ))}

            {notes.length === 0 && (
              <p className="text-center text-sm text-gray-500 py-8">
                No notes yet. Create your first note!
              </p>
            )}
          </div>

          {/* Note Editor */}
          <div className="col-span-9">
            {selectedNote ? (
              <div className="rounded-lg bg-white p-6 shadow">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-gray-900">
                    {selectedNote.title}
                  </h2>
                  <button
                    onClick={handleSaveNote}
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
                  >
                    Save
                  </button>
                </div>
                <textarea
                  className="w-full min-h-[500px] rounded-md border border-gray-300 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:outline-none"
                  value={editingContent}
                  onChange={(e) => setEditingContent(e.target.value)}
                  placeholder="Start writing your note..."
                />
              </div>
            ) : (
              <div className="flex items-center justify-center rounded-lg bg-white p-12 shadow">
                <p className="text-gray-500">
                  Select a note to view or edit
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Create Note Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-white p-6">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              Create New Note
            </h3>
            <form onSubmit={handleCreateNote}>
              <input
                type="text"
                placeholder="Note title"
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                value={newNoteTitle}
                onChange={(e) => setNewNoteTitle(e.target.value)}
                autoFocus
              />
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewNoteTitle('');
                  }}
                  className="rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
