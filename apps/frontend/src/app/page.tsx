'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-white px-4">
      <main className="w-full max-w-4xl text-center">
        <h1 className="mb-6 text-6xl font-bold text-gray-900">
          Task Management
        </h1>
        <p className="mb-12 text-xl text-gray-600">
          Organize your work and collaborate with your team seamlessly
        </p>
        <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
          <Link
            href="/auth/register"
            className="rounded-lg bg-blue-600 px-8 py-3 text-lg font-semibold text-white hover:bg-blue-500 transition-colors"
          >
            Get Started
          </Link>
          <Link
            href="/auth/login"
            className="rounded-lg border-2 border-blue-600 px-8 py-3 text-lg font-semibold text-blue-600 hover:bg-blue-50 transition-colors"
          >
            Sign In
          </Link>
        </div>
        <div className="mt-20 grid gap-8 sm:grid-cols-3">
          <div className="rounded-lg bg-white p-6 shadow-md">
            <h3 className="mb-2 text-xl font-semibold">Workspaces</h3>
            <p className="text-gray-600">
              Organize your projects into separate workspaces
            </p>
          </div>
          <div className="rounded-lg bg-white p-6 shadow-md">
            <h3 className="mb-2 text-xl font-semibold">Kanban Boards</h3>
            <p className="text-gray-600">
              Visualize your workflow with drag-and-drop boards
            </p>
          </div>
          <div className="rounded-lg bg-white p-6 shadow-md">
            <h3 className="mb-2 text-xl font-semibold">Real-time Collaboration</h3>
            <p className="text-gray-600">
              Work together with your team in real-time
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
