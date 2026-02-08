'use client';

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useWorkspaces as useWorkspacesQuery, queryKeys } from '@/hooks/use-queries';
import { useQueryClient } from '@tanstack/react-query';

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

interface WorkspaceContextType {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  setActiveWorkspace: (workspace: Workspace | null) => void;
  loadWorkspaces: () => Promise<void>;
  isLoading: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [internalActiveWorkspace, setInternalActiveWorkspace] = useState<Workspace | null>(null);

  const { data: workspacesData, isLoading } = useWorkspacesQuery({
    enabled: !!user,
  });

  const workspaces = (workspacesData ?? []) as Workspace[];

  // Auto-select first workspace if none selected (or selected was removed)
  const activeWorkspace = useMemo(() => {
    if (internalActiveWorkspace) {
      // Verify it still exists in the list
      const stillExists = workspaces.some((w) => w.id === internalActiveWorkspace.id);
      if (stillExists) return internalActiveWorkspace;
    }
    return workspaces.length > 0 ? workspaces[0] : null;
  }, [internalActiveWorkspace, workspaces]);

  const setActiveWorkspace = useCallback((workspace: Workspace | null) => {
    setInternalActiveWorkspace(workspace);
  }, []);

  // Backwards-compatible loadWorkspaces: just invalidate the React Query cache
  const loadWorkspaces = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: queryKeys.workspaces });
  }, [qc]);

  const value = useMemo(() => ({
    workspaces,
    activeWorkspace,
    setActiveWorkspace,
    loadWorkspaces,
    isLoading,
  }), [workspaces, activeWorkspace, setActiveWorkspace, loadWorkspaces, isLoading]);

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}
