'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';

interface JoinWorkspaceDialogProps {
  children?: React.ReactNode;
}

export function JoinWorkspaceDialog({ children }: JoinWorkspaceDialogProps) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const queryClient = useQueryClient();

  const handleJoin = async () => {
    if (!code.trim()) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/workspaces/join-code/${code.trim().toUpperCase()}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to join workspace');
      }

      const result = await res.json();
      toast.success('Joined workspace!', {
        description: `You joined "${result.workspace.name}" as ${result.role}`,
      });

      // Refresh workspaces list
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      setOpen(false);
      setCode('');
    } catch (error) {
      toast.error('Error', {
        description: error instanceof Error ? error.message : 'Failed to join',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm">
            <UserPlus className="h-4 w-4 mr-2" />
            Join Workspace
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Join Workspace</DialogTitle>
          <DialogDescription>
            Enter the 6-character code to join a workspace
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="code">Workspace Code</Label>
            <Input
              id="code"
              placeholder="ABC123"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
              className="text-center text-2xl font-mono tracking-widest"
              maxLength={6}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleJoin} disabled={loading || code.length !== 6}>
            {loading ? 'Joining...' : 'Join'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
