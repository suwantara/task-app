'use client';

import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';

const SOCKET_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3000';

interface PresenceUser {
  userId: string;
  name: string;
  avatarUrl?: string;
  cursor?: { x: number; y: number };
}

interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
  joinRoom: (room: string) => void;
  leaveRoom: (room: string) => void;
  onlineUsers: PresenceUser[];
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  connected: false,
  joinRoom: () => {},
  leaveRoom: () => {},
  onlineUsers: [],
});

export function SocketProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);
  const joinedRoomsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;

    const token = apiClient.getToken();
    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      setConnected(true);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('presence:update', (data: { users: PresenceUser[] }) => {
      setOnlineUsers(data.users);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
      joinedRoomsRef.current.clear();
    };
  }, [user]);

  const joinRoom = useCallback(
    (room: string) => {
      if (socketRef.current && user && !joinedRoomsRef.current.has(room)) {
        socketRef.current.emit('joinRoom', {
          room,
          user: { userId: user.id, name: user.name, avatarUrl: user.avatarUrl },
        });
        joinedRoomsRef.current.add(room);
      }
    },
    [user],
  );

  const leaveRoom = useCallback((room: string) => {
    if (socketRef.current && joinedRoomsRef.current.has(room)) {
      socketRef.current.emit('leaveRoom', room);
      joinedRoomsRef.current.delete(room);
    }
  }, []);

  return (
    <SocketContext.Provider
      value={{
        socket: socketRef.current,
        connected,
        joinRoom,
        leaveRoom,
        onlineUsers,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
