'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Crown, Pencil, Eye } from 'lucide-react';

interface Member {
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

interface WorkspaceMembersProps {
  members: Member[];
  maxVisible?: number;
  size?: 'sm' | 'md';
}

const roleColors: Record<string, string> = {
  OWNER: 'ring-yellow-500',
  EDITOR: 'ring-blue-500',
  VIEWER: 'ring-gray-400',
};

const roleIcons: Record<string, React.ReactNode> = {
  OWNER: <Crown className="size-2.5" />,
  EDITOR: <Pencil className="size-2.5" />,
  VIEWER: <Eye className="size-2.5" />,
};

export function WorkspaceMembers({
  members,
  maxVisible = 4,
  size = 'sm',
}: WorkspaceMembersProps) {
  if (!members || members.length === 0) return null;

  const visible = members.slice(0, maxVisible);
  const overflow = members.length - maxVisible;
  const sizeClass = size === 'sm' ? 'size-6' : 'size-8';
  const textClass = size === 'sm' ? 'text-[10px]' : 'text-xs';

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center -space-x-1.5">
        {visible.map((member) => (
          <Tooltip key={member.id}>
            <TooltipTrigger asChild>
              <Avatar
                className={`${sizeClass} ring-2 ring-background ${roleColors[member.role] || ''} cursor-default`}
              >
                <AvatarFallback className={`${textClass} bg-muted`}>
                  {member.user.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              <div className="flex items-center gap-1">
                {roleIcons[member.role]}
                <span className="font-medium">{member.user.name}</span>
                <span className="text-muted-foreground">
                  ({member.role.charAt(0) + member.role.slice(1).toLowerCase()})
                </span>
              </div>
            </TooltipContent>
          </Tooltip>
        ))}

        {overflow > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Avatar className={`${sizeClass} cursor-default ring-2 ring-background`}>
                <AvatarFallback className={`${textClass} bg-muted`}>
                  +{overflow}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {members.slice(maxVisible).map((m) => m.user.name).join(', ')}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
