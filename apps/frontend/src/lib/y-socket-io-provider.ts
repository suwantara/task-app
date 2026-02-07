import * as Y from 'yjs';
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate, removeAwarenessStates } from 'y-protocols/awareness';
import type { Socket } from 'socket.io-client';

const CURSOR_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
];

export function getUserColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i);
    hash |= 0;
  }
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length];
}

/**
 * A Yjs sync provider over Socket.IO.
 * Syncs a Y.Doc and Awareness through the existing Socket.IO connection.
 */
export class SocketIOYjsProvider {
  doc: Y.Doc;
  awareness: Awareness;
  synced = false;
  userColor: string = '#888';

  private socket: Socket;
  private noteId: string;
  private updateHandler: (update: Uint8Array, origin: unknown) => void;
  private awarenessHandler: (
    changes: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown,
  ) => void;
  private destroyed = false;
  private onSyncedCallback?: () => void;

  constructor(
    socket: Socket,
    noteId: string,
    doc: Y.Doc,
    opts?: {
      user?: { name: string; color: string };
      onSynced?: () => void;
    },
  ) {
    this.socket = socket;
    this.noteId = noteId;
    this.doc = doc;
    this.awareness = new Awareness(doc);
    this.onSyncedCallback = opts?.onSynced;

    // Set local awareness state and store user color
    if (opts?.user) {
      this.userColor = opts.user.color;
      this.awareness.setLocalStateField('user', opts.user);
    }

    // Listen for sync response (initial state from server)
    this.socket.on('yjs:sync', this._handleSync);

    // Listen for remote updates
    this.socket.on('yjs:update', this._handleRemoteUpdate);

    // Listen for remote awareness updates
    this.socket.on('yjs:awareness', this._handleRemoteAwareness);

    // Forward local doc updates to server
    this.updateHandler = (update: Uint8Array, origin: unknown) => {
      if (this.destroyed || origin === 'remote') return;
      this.socket.emit('yjs:update', {
        noteId: this.noteId,
        update: Array.from(update),
      });
    };
    this.doc.on('update', this.updateHandler);

    // Forward local awareness updates to server
    this.awarenessHandler = ({ added, updated, removed }) => {
      if (this.destroyed) return;
      const changedClients = [...added, ...updated, ...removed];
      const encodedUpdate = encodeAwarenessUpdate(this.awareness, changedClients);
      this.socket.emit('yjs:awareness', {
        noteId: this.noteId,
        update: Array.from(encodedUpdate),
      });
    };
    this.awareness.on('update', this.awarenessHandler);

    // Join note room on server
    this.socket.emit('yjs:join', { noteId: this.noteId });
  }

  private _handleSync = (data: { noteId: string; update: number[] }) => {
    if (this.destroyed || data.noteId !== this.noteId) return;
    if (data.update && data.update.length > 0) {
      Y.applyUpdate(this.doc, new Uint8Array(data.update), 'remote');
    }
    if (!this.synced) {
      this.synced = true;
      this.onSyncedCallback?.();
    }
  };

  private _handleRemoteUpdate = (data: { noteId: string; update: number[] }) => {
    if (this.destroyed || data.noteId !== this.noteId) return;
    Y.applyUpdate(this.doc, new Uint8Array(data.update), 'remote');
  };

  private _handleRemoteAwareness = (data: { noteId: string; update: number[] }) => {
    if (this.destroyed || data.noteId !== this.noteId) return;
    applyAwarenessUpdate(this.awareness, new Uint8Array(data.update), 'remote');
  };

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;

    this.doc.off('update', this.updateHandler);
    this.awareness.off('update', this.awarenessHandler);
    this.socket.off('yjs:sync', this._handleSync);
    this.socket.off('yjs:update', this._handleRemoteUpdate);
    this.socket.off('yjs:awareness', this._handleRemoteAwareness);

    removeAwarenessStates(this.awareness, [this.doc.clientID], null);

    this.socket.emit('yjs:leave', { noteId: this.noteId });
  }
}
