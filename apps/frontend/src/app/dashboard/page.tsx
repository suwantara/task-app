'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api';

interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export default function DashboardPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');

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

  const loadWorkspaces = async () => {
    try {
      const data = await apiClient.getWorkspaces();
      setWorkspaces(data);
    } catch (error) {
      console.error('Failed to load workspaces:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;

    try {
      await apiClient.createWorkspace(newWorkspaceName);
      setNewWorkspaceName('');
      setShowCreateModal(false);
      loadWorkspaces();
    } catch (error) {
      console.error('Failed to create workspace:', error);
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
          <h1 className="text-2xl font-bold text-gray-900">Task Management</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user?.name}</span>
            <button
              onClick={logout}
              className="rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            Your Workspaces
          </h2>
          <button
            onClick={() => setShowCreateModal(true)}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
          >
            Create Workspace
          </button>
        </div>

        {/* Workspaces Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((workspace) => (
            <Link
              key={workspace.id}
              href={`/workspace/${workspace.id}`}
              className="block rounded-lg bg-white p-6 shadow hover:shadow-lg transition-shadow"
            >
              <h3 className="text-lg font-semibold text-gray-900">
                {workspace.name}
              </h3>
              <p className="mt-2 text-sm text-gray-500">
                Created {new Date(workspace.createdAt).toLocaleDateString()}
              </p>
            </Link>
          ))}

          {workspaces.length === 0 && (
            <div className="col-span-full text-center py-12">
              <p className="text-gray-500">
                No workspaces yet. Create your first workspace to get started!
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Create Workspace Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-white p-6">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              Create New Workspace
            </h3>
            <form onSubmit={handleCreateWorkspace}>
              <input
                type="text"
                placeholder="Workspace name"
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                autoFocus
              />
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewWorkspaceName('');
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
