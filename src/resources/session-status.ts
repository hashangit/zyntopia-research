// src/resources/session-status.ts
import type { Resource } from '@modelcontextprotocol/sdk/types.js';
import { getSessionManager } from '../core/session-manager.js';

export interface SessionStatus {
  activeSessionCount: number;
  maxSessions: number;
  sessions: Array<{
    id: string;  // Truncated for privacy
    ageSeconds: number;
    idleSeconds: number;
    device?: string;
    isActive: boolean;
  }>;
}

export function getSessionStatusResource(): Resource {
  return {
    uri: 'session://status',
    name: 'Active Sessions',
    description: 'Information about active browser sessions',
    mimeType: 'application/json',
  };
}

export async function readSessionStatus(): Promise<SessionStatus> {
  const sessionManager = getSessionManager();
  const stats = sessionManager.getStats();
  const now = Date.now();

  return {
    activeSessionCount: stats.activeCount,
    maxSessions: stats.maxSessions,
    sessions: stats.sessions.map(s => ({
      id: s.id.substring(0, 8) + '...',  // Truncated for privacy
      ageSeconds: Math.floor((now - s.createdAt.getTime()) / 1000),
      idleSeconds: Math.floor((now - s.lastUsedAt.getTime()) / 1000),
      device: s.device,
      isActive: s.isActive,
    })),
  };
}
