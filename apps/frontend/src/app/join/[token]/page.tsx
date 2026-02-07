'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, CheckCircle2, XCircle, Pencil, Eye } from 'lucide-react';

interface InviteLinkInfo {
  workspaceName: string;
  role: string;
  isActive: boolean;
  isExpired: boolean;
  isMaxedOut: boolean;
  memberCount: number;
}

export default function JoinWorkspacePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [info, setInfo] = useState<InviteLinkInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const loadInfo = useCallback(async () => {
    try {
      const data = await apiClient.getInviteLinkInfo(token);
      setInfo(data);
    } catch {
      setError('This invite link is invalid or no longer exists.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadInfo();
  }, [loadInfo]);

  useEffect(() => {
    if (!authLoading && !user) {
      // Store the current URL so we can redirect back after login
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('redirectAfterLogin', window.location.pathname);
      }
      router.push('/auth/login');
    }
  }, [user, authLoading, router]);

  const handleJoin = async () => {
    setJoining(true);
    setError(null);
    try {
      const result = await apiClient.joinByInviteLink(token);
      setSuccess(true);
      setTimeout(() => {
        router.push(`/workspace/${result.workspace.id}`);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join workspace');
    } finally {
      setJoining(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isInvalid = info && (!info.isActive || info.isExpired || info.isMaxedOut);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">
            {success ? (
              <span className="flex items-center justify-center gap-2 text-green-500">
                <CheckCircle2 className="size-6" />
                Joined!
              </span>
            ) : error && !info ? (
              <span className="flex items-center justify-center gap-2 text-destructive">
                <XCircle className="size-6" />
                Invalid Link
              </span>
            ) : (
              'Workspace Invitation'
            )}
          </CardTitle>
          <CardDescription>
            {success
              ? 'Redirecting to workspace...'
              : error && !info
                ? error
                : 'You have been invited to join a workspace'}
          </CardDescription>
        </CardHeader>

        {info && !success && (
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4 text-center">
              <h3 className="text-lg font-semibold">{info.workspaceName}</h3>
              <div className="mt-2 flex items-center justify-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="size-4" />
                  {info.memberCount} member{info.memberCount !== 1 ? 's' : ''}
                </span>
                <Badge variant="secondary" className="gap-1">
                  {info.role === 'EDITOR' ? (
                    <Pencil className="size-3" />
                  ) : (
                    <Eye className="size-3" />
                  )}
                  {info.role === 'EDITOR' ? 'Can Edit' : 'View Only'}
                </Badge>
              </div>
            </div>

            {isInvalid ? (
              <div className="space-y-3">
                <p className="text-center text-sm text-destructive">
                  {!info.isActive && 'This invite link has been revoked.'}
                  {info.isExpired && 'This invite link has expired.'}
                  {info.isMaxedOut && 'This invite link has reached its maximum uses.'}
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => router.push('/dashboard')}
                >
                  Go to Dashboard
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {error && (
                  <p className="text-center text-sm text-destructive">{error}</p>
                )}
                <Button
                  className="w-full"
                  onClick={handleJoin}
                  disabled={joining}
                >
                  {joining && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Join Workspace
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => router.push('/dashboard')}
                >
                  Cancel
                </Button>
              </div>
            )}
          </CardContent>
        )}

        {!info && error && (
          <CardContent>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => router.push('/dashboard')}
            >
              Go to Dashboard
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
