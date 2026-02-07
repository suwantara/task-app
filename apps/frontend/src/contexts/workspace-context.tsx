'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';

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
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [internalActiveWorkspace, setInternalActiveWorkspace] = useState<Workspace | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadWorkspaces = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const data = await apiClient.getWorkspaces();
      setWorkspaces(data as Workspace[]);
      
      // Auto-select first workspace if none selected
      if (data.length > 0) {
        setInternalActiveWorkspace((current) => current || (data[0] as Workspace));
      }
    } catch (error) {
      console.error('Failed to load workspaces:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const setActiveWorkspace = useCallback((workspace: Workspace | null) => {
    setInternalActiveWorkspace(workspace);
  }, []);

  // Load workspaces when user logs in
  useEffect(() => {
    if (user) {
      loadWorkspaces();
    } else {
      setWorkspaces([]);
      setInternalActiveWorkspace(null);
    }
  }, [user, loadWorkspaces]);

  const value = useMemo(() => ({
    workspaces,
    activeWorkspace: internalActiveWorkspace,
    setActiveWorkspace,
    loadWorkspaces,
    isLoading,
  }), [workspaces, internalActiveWorkspace, setActiveWorkspace, loadWorkspaces, isLoading]);

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
