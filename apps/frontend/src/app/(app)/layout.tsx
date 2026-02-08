'use client';

import { useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { Separator } from '@/components/ui/separator';
import { SocketProvider } from '@/contexts/socket-context';
import { WorkspaceProvider } from '@/contexts/workspace-context';
import { PresenceIndicator } from '@/components/presence-indicator';
import { TooltipProvider } from '@/components/ui/tooltip';
import { usePagePresence } from '@/hooks/use-page-presence';
import { RealTimeClock } from '@/components/realtime-clock';

// Wrapper component to use hooks inside SocketProvider
function PagePresenceTracker() {
  usePagePresence();
  return null;
}

export default function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <SocketProvider>
      <WorkspaceProvider>
        <PagePresenceTracker />
        <TooltipProvider delayDuration={200}>
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset className="overflow-hidden">
              <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
                <SidebarTrigger className="-ml-1" />
                <Separator orientation="vertical" className="mr-2 h-4" />
                <div className="flex flex-1 justify-center">
                  <RealTimeClock />
                </div>
                <PresenceIndicator />
              </header>
              <main className="flex-1 overflow-hidden">{children}</main>
            </SidebarInset>
          </SidebarProvider>
        </TooltipProvider>
      </WorkspaceProvider>
    </SocketProvider>
  );
}

