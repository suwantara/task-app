'use client';

import { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';

const SOCKET_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3000';

interface PresenceUser {
  userId: string;
  name: string;
  avatarUrl?: string;
  cursor?: { x: number; y: number };
  currentPage?: string;
}

interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
  joinRoom: (room: string) => void;
  leaveRoom: (room: string) => void;
  onlineUsers: PresenceUser[];
  currentPage: string;
  setCurrentPage: (page: string) => void;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  connected: false,
  joinRoom: () => {},
  leaveRoom: () => {},
  onlineUsers: [],
  currentPage: '',
  setCurrentPage: () => {},
});

export function SocketProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);
  const [currentPage, internalSetCurrentPage] = useState('');
  const joinedRoomsRef = useRef<Set<string>>(new Set());
  const currentRoomRef = useRef<string | null>(null);
  // Version counter to trigger context updates when socket changes
  const [socketVersion, setSocketVersion] = useState(0);

  useEffect(() => {
    if (!user) return;

    const token = apiClient.getToken();
    if (!token) return;

    const newSocket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
    });

    newSocket.on('connect', () => {
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
    });

    newSocket.on('presence:update', (data: { users: PresenceUser[] }) => {
      setOnlineUsers(data.users);
    });

    socketRef.current = newSocket;
    setSocketVersion((v) => v + 1);

    // Copy ref value before cleanup (React lint requirement)
    const joinedRooms = joinedRoomsRef.current;

    return () => {
      newSocket.disconnect();
      socketRef.current = null;
      joinedRooms.clear();
    };
  }, [user]);


  const joinRoom = useCallback(
    (room: string) => {
      if (socketRef.current && user && !joinedRoomsRef.current.has(room)) {
        socketRef.current.emit('joinRoom', {
          room,
          user: { userId: user.id, name: user.name, avatarUrl: user.avatarUrl, currentPage: currentPage },
        });
        joinedRoomsRef.current.add(room);
        currentRoomRef.current = room;
      }
    },
    [user, currentPage],
  );

  const leaveRoom = useCallback((room: string) => {
    if (socketRef.current && joinedRoomsRef.current.has(room)) {
      socketRef.current.emit('leaveRoom', room);
      joinedRoomsRef.current.delete(room);
      if (currentRoomRef.current === room) {
        currentRoomRef.current = null;
      }
    }
  }, []);

  const setCurrentPage = useCallback((page: string) => {
    internalSetCurrentPage(page);
    // Emit page update to server if connected and in a room
    if (socketRef.current && currentRoomRef.current) {
      socketRef.current.emit('presence:update-page', {
        room: currentRoomRef.current,
        page,
      });
    }
  }, []);

  // Memoize context value to include socket from ref, triggered by socketVersion
  const contextValue = useMemo<SocketContextType>(
    () => ({
      socket: socketRef.current,
      connected,
      joinRoom,
      leaveRoom,
      onlineUsers,
      currentPage,
      setCurrentPage,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [socketVersion, connected, joinRoom, leaveRoom, onlineUsers, currentPage, setCurrentPage],
  );

  return (
    <SocketContext.Provider value={contextValue}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}

