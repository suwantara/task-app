'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useSocket } from '@/contexts/socket-context';

/**
 * Maps pathname to readable page name for presence display
 */
function getPageName(pathname: string | null): string {
  if (!pathname) return 'Dashboard';
  
  const segments = pathname.split('/').filter(Boolean);
  
  if (segments.length === 0 || pathname === '/') return 'Dashboard';

  
  const pageMap: Record<string, string> = {
    'dashboard': 'Dashboard',
    'notes': 'Notes',
    'tasks': 'Tasks',
    'board': 'Board',
    'settings': 'Settings',
    'workspace': 'Workspace',
  };
  
  const mainPage = segments[0];
  
  // Handle app routes that start with (app)
  if (mainPage?.startsWith('(')) {
    return pageMap[segments[1]] || segments[1] || 'App';
  }
  
  if (!mainPage) return 'Dashboard';
  return pageMap[mainPage] || mainPage.charAt(0).toUpperCase() + mainPage.slice(1);
}

/**
 * Hook that automatically updates page presence when user navigates
 */
export function usePagePresence() {
  const pathname = usePathname();
  const { setCurrentPage, connected } = useSocket();

  useEffect(() => {
    if (!connected) return;
    
    const pageName = getPageName(pathname);
    setCurrentPage(pageName);
  }, [pathname, setCurrentPage, connected]);

  return { currentPath: pathname };
}
