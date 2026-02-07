'use client';

import { useSocket } from '@/contexts/socket-context';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Wifi, WifiOff, MapPin } from 'lucide-react';

export function PresenceIndicator() {
  const { connected, onlineUsers } = useSocket();

  // Group users by page for better display
  const usersByPage = onlineUsers.reduce((acc, user) => {
    const page = user.currentPage || 'Unknown';
    if (!acc[page]) acc[page] = [];
    acc[page].push(user);
    return acc;
  }, {} as Record<string, typeof onlineUsers>);

  return (
    <div className="flex items-center gap-2">
      {/* Connection status */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1">
            {connected ? (
              <Wifi className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <WifiOff className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {connected ? 'Connected — real-time sync active' : 'Disconnected'}
        </TooltipContent>
      </Tooltip>

      {/* Online users avatars */}
      {onlineUsers.length > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex -space-x-2">
              {onlineUsers.slice(0, 5).map((u) => (
                <Avatar key={u.userId} className="h-6 w-6 border-2 border-background">
                  <AvatarFallback className="text-[10px]">
                    {(u.name ?? '?').charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ))}
              {onlineUsers.length > 5 && (
                <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-muted text-[10px] font-medium">
                  +{onlineUsers.length - 5}
                </div>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <div className="space-y-2">
              <p className="text-xs font-medium">{onlineUsers.length} user(s) online</p>
              {Object.entries(usersByPage).map(([page, users]) => (
                <div key={page} className="flex items-start gap-1.5 text-xs">
                  <MapPin className="mt-0.5 h-3 w-3 text-muted-foreground shrink-0" />
                  <div>
                    <span className="font-medium">{page}:</span>{' '}
                    <span className="text-muted-foreground">
                      {users.map((u) => (u.name ?? 'Unknown').split('@')[0]).join(', ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
