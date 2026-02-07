'use client';

import { useSocket } from '@/contexts/socket-context';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Wifi, WifiOff } from 'lucide-react';

export function PresenceIndicator() {
  const { connected, onlineUsers } = useSocket();

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
        <div className="flex -space-x-2">
          {onlineUsers.slice(0, 5).map((u) => (
            <Tooltip key={u.userId}>
              <TooltipTrigger asChild>
                <Avatar className="h-6 w-6 border-2 border-background">
                  <AvatarFallback className="text-[10px]">
                    {u.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent>{u.name}</TooltipContent>
            </Tooltip>
          ))}
          {onlineUsers.length > 5 && (
            <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-muted text-[10px] font-medium">
              +{onlineUsers.length - 5}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
