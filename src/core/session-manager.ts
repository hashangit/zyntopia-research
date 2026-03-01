import { runAgentBrowser } from './browser.js';

export interface BrowserSession {
  id: string;
  createdAt: Date;
  lastUsedAt: Date;
  device?: string;
  proxy?: string;
  isActive: boolean;
}

export interface SessionConfig {
  device?: 'desktop' | 'mobile' | 'iphone' | 'android';
  proxy?: string;
}

// Device emulation profiles mapping to agent-browser device names
const DEVICE_PROFILES: Record<string, string> = {
  desktop: '', // Default, no special device
  mobile: 'Pixel 5',
  iphone: 'iPhone 13',
  android: 'Pixel 5',
};

export class BrowserSessionManager {
  private sessions: Map<string, BrowserSession> = new Map();
  private maxSessions = 5;
  private sessionTimeout = 30 * 60 * 1000; // 30 minutes
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions().catch(console.error);
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `session-${timestamp}-${random}`;
  }

  /**
   * Find the oldest inactive session
   */
  private findOldestInactiveSession(): string | null {
    let oldestId: string | null = null;
    let oldestTime = Date.now();

    for (const [id, session] of this.sessions) {
      if (!session.isActive && session.lastUsedAt.getTime() < oldestTime) {
        oldestTime = session.lastUsedAt.getTime();
        oldestId = id;
      }
    }

    return oldestId;
  }

  /**
   * Create a new browser session
   */
  async createSession(config: SessionConfig = {}): Promise<string> {
    // Check session limit
    if (this.sessions.size >= this.maxSessions) {
      // Remove oldest inactive session
      const oldest = this.findOldestInactiveSession();
      if (oldest) {
        await this.closeSession(oldest);
      } else {
        throw new Error(`Maximum sessions (${this.maxSessions}) reached. Close a session first.`);
      }
    }

    const sessionId = this.generateSessionId();
    const session: BrowserSession = {
      id: sessionId,
      createdAt: new Date(),
      lastUsedAt: new Date(),
      device: config.device,
      proxy: config.proxy,
      isActive: true,
    };

    this.sessions.set(sessionId, session);
    return sessionId;
  }

  /**
   * Get an existing session by ID
   */
  async getSession(id: string): Promise<BrowserSession | null> {
    const session = this.sessions.get(id);
    if (!session) {
      return null;
    }

    // Check if session has expired
    const age = Date.now() - session.lastUsedAt.getTime();
    if (age > this.sessionTimeout) {
      await this.closeSession(id);
      return null;
    }

    return session;
  }

  /**
   * Find a matching session or create a new one
   */
  async reuseOrCreate(config: SessionConfig = {}): Promise<{ sessionId: string; session: BrowserSession }> {
    // Try to find a matching session
    for (const [id, session] of this.sessions) {
      const age = Date.now() - session.lastUsedAt.getTime();
      if (age > this.sessionTimeout) {
        await this.closeSession(id);
        continue;
      }

      // Check if config matches
      const deviceMatches = !config.device || session.device === config.device;
      const proxyMatches = !config.proxy || session.proxy === config.proxy;

      if (deviceMatches && proxyMatches) {
        session.lastUsedAt = new Date();
        return { sessionId: id, session };
      }
    }

    // No matching session found, create new
    const sessionId = await this.createSession(config);
    const session = this.sessions.get(sessionId)!;
    return { sessionId, session };
  }

  /**
   * Close and cleanup a session
   */
  async closeSession(id: string): Promise<void> {
    const session = this.sessions.get(id);
    if (!session) {
      return;
    }

    try {
      // Close browser with session name to cleanup
      await runAgentBrowser(['close'], 10000, { sessionId: id });
    } catch {
      // Ignore close errors
    }

    this.sessions.delete(id);
  }

  /**
   * Cleanup sessions that have been idle too long
   */
  async cleanupExpiredSessions(): Promise<void> {
    const now = Date.now();
    const expiredIds: string[] = [];

    for (const [id, session] of this.sessions) {
      const age = now - session.lastUsedAt.getTime();
      if (age > this.sessionTimeout) {
        expiredIds.push(id);
      }
    }

    for (const id of expiredIds) {
      await this.closeSession(id);
    }
  }

  /**
   * Get the device profile name for agent-browser
   */
  private getDeviceProfile(device?: string): string | undefined {
    if (!device || device === 'desktop') {
      return undefined;
    }
    return DEVICE_PROFILES[device];
  }

  /**
   * Build CLI args for session-specific options
   */
  buildSessionArgs(sessionId: string): string[] {
    return ['--session-name', sessionId];
  }

  /**
   * Build device-specific args
   */
  buildDeviceArgs(device?: string): string[] {
    const deviceProfile = this.getDeviceProfile(device);
    if (!deviceProfile) {
      return [];
    }
    return ['--device', deviceProfile];
  }

  /**
   * Build proxy args
   */
  buildProxyArgs(proxy?: string): string[] {
    if (!proxy) {
      return [];
    }
    return ['--proxy', proxy];
  }

  /**
   * Execute an operation within a session context
   */
  async executeInSession<T>(
    sessionId: string,
    fn: (session: BrowserSession) => Promise<T>
  ): Promise<T> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found or expired: ${sessionId}`);
    }

    // Update last used time
    session.lastUsedAt = new Date();

    try {
      return await fn(session);
    } catch (error) {
      // Mark session as potentially stale on error
      session.isActive = false;
      throw error;
    }
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): BrowserSession[] {
    return Array.from(this.sessions.values()).filter(s => s.isActive);
  }

  /**
   * Get session count
   */
  getSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Get session statistics for resource monitoring
   */
  getStats(): {
    activeCount: number;
    maxSessions: number;
    sessions: Array<{
      id: string;
      createdAt: Date;
      lastUsedAt: Date;
      device?: string;
      isActive: boolean;
    }>;
  } {
    const now = Date.now();
    const sessions = Array.from(this.sessions.values())
      .filter(session => now - session.lastUsedAt.getTime() <= this.sessionTimeout)
      .map(session => ({
        id: session.id,
        createdAt: session.createdAt,
        lastUsedAt: session.lastUsedAt,
        device: session.device,
        isActive: session.isActive,
      }));

    return {
      activeCount: sessions.filter(s => s.isActive).length,
      maxSessions: this.maxSessions,
      sessions,
    };
  }

  /**
   * Cleanup all sessions and stop cleanup interval
   */
  async destroy(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    for (const id of this.sessions.keys()) {
      await this.closeSession(id);
    }
  }
}

// Singleton instance
let sessionManager: BrowserSessionManager | null = null;

export function getSessionManager(): BrowserSessionManager {
  if (!sessionManager) {
    sessionManager = new BrowserSessionManager();
  }
  return sessionManager;
}

export function destroySessionManager(): void {
  if (sessionManager) {
    sessionManager.destroy().catch(console.error);
    sessionManager = null;
  }
}
