import { storage } from './storage';
import type { AppUser, AuditLog, UserRole } from '../types';

const USERS_KEY = 'factory_users';
const SESSION_KEY = 'factory_session';
const AUDIT_LOGS_KEY = 'factory_audit_logs';

type SessionUser = Omit<AppUser, 'password'>;

const normalizeUsername = (username: string) => username.trim().toLowerCase();

export const auth = {
  listAuditLogs(): AuditLog[] {
    return storage
      .get<AuditLog>(AUDIT_LOGS_KEY)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  },

  logAction(entry: Omit<AuditLog, 'id' | 'timestamp'>): void {
    const logs = storage.get<AuditLog>(AUDIT_LOGS_KEY);
    const log: AuditLog = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...entry,
    };
    logs.push(log);
    storage.set<AuditLog>(AUDIT_LOGS_KEY, logs);
  },

  ensureSeedAdmin(): void {
    const users = storage.get<AppUser>(USERS_KEY);
    if (users.length > 0) {
      return;
    }

    storage.set<AppUser>(USERS_KEY, [
      {
        id: crypto.randomUUID(),
        name: 'System Admin',
        username: 'admin',
        password: 'admin123',
        role: 'admin',
        createdAt: new Date().toISOString(),
      },
    ]);
  },

  listUsers(): AppUser[] {
    return storage.get<AppUser>(USERS_KEY);
  },

  createUser(user: Omit<AppUser, 'id' | 'createdAt'>): AppUser {
    const users = this.listUsers();
    const normalized = normalizeUsername(user.username);
    if (users.some((existing) => normalizeUsername(existing.username) === normalized)) {
      throw new Error('Username already exists');
    }

    const newUser: AppUser = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      ...user,
      username: user.username.trim(),
    };
    storage.set<AppUser>(USERS_KEY, [...users, newUser]);

    const session = this.getSessionUser();
    this.logAction({
      actorId: session?.id,
      actorName: session?.name ?? 'System',
      action: 'User Created',
      targetUserId: newUser.id,
      targetUserName: newUser.name,
      detail: `${newUser.username} (${newUser.role})`,
    });

    return newUser;
  },

  updateUser(
    id: string,
    updates: Partial<Pick<AppUser, 'name' | 'username' | 'password' | 'role'>>,
  ): AppUser {
    const users = this.listUsers();
    const index = users.findIndex((user) => user.id === id);

    if (index === -1) {
      throw new Error('User not found');
    }

    if (updates.username) {
      const normalized = normalizeUsername(updates.username);
      const duplicate = users.some(
        (user) => user.id !== id && normalizeUsername(user.username) === normalized,
      );
      if (duplicate) {
        throw new Error('Username already exists');
      }
    }

    const updatedUser = {
      ...users[index],
      ...updates,
      username: updates.username ? updates.username.trim() : users[index].username,
    };

    users[index] = updatedUser;
    storage.set<AppUser>(USERS_KEY, users);

    const session = this.getSessionUser();
    if (session?.id === id) {
      this.setSessionUser(updatedUser);
    }

    this.logAction({
      actorId: session?.id,
      actorName: session?.name ?? 'System',
      action: 'User Updated',
      targetUserId: updatedUser.id,
      targetUserName: updatedUser.name,
      detail: `${updatedUser.username} (${updatedUser.role})`,
    });

    return updatedUser;
  },

  deleteUser(id: string): void {
    const users = this.listUsers();
    const toDelete = users.find((user) => user.id === id);

    if (!toDelete) {
      throw new Error('User not found');
    }

    if (toDelete.role === 'admin') {
      const adminCount = users.filter((user) => user.role === 'admin').length;
      if (adminCount <= 1) {
        throw new Error('At least one admin user is required');
      }
    }

    storage.set(
      USERS_KEY,
      users.filter((user) => user.id !== id),
    );

    const session = this.getSessionUser();
    if (session?.id === id) {
      this.logout();
    }

    this.logAction({
      actorId: session?.id,
      actorName: session?.name ?? 'System',
      action: 'User Deleted',
      targetUserId: toDelete.id,
      targetUserName: toDelete.name,
      detail: `${toDelete.username} (${toDelete.role})`,
    });
  },

  login(username: string, password: string): SessionUser {
    const users = this.listUsers();
    const user = users.find(
      (item) =>
        normalizeUsername(item.username) === normalizeUsername(username) &&
        item.password === password,
    );

    if (!user) {
      throw new Error('Invalid username or password');
    }

    this.setSessionUser(user);
    this.logAction({
      actorId: user.id,
      actorName: user.name,
      action: 'User Login',
      targetUserId: user.id,
      targetUserName: user.name,
      detail: user.username,
    });
    return this.toSessionUser(user);
  },

  logout(): void {
    const session = this.getSessionUser();
    if (session) {
      this.logAction({
        actorId: session.id,
        actorName: session.name,
        action: 'User Logout',
        targetUserId: session.id,
        targetUserName: session.name,
        detail: session.username,
      });
    }
    localStorage.removeItem(SESSION_KEY);
  },

  getSessionUser(): SessionUser | null {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? (JSON.parse(raw) as SessionUser) : null;
    } catch {
      return null;
    }
  },

  setSessionUser(user: AppUser | SessionUser): void {
    localStorage.setItem(SESSION_KEY, JSON.stringify(this.toSessionUser(user)));
  },

  toSessionUser(user: AppUser | SessionUser): SessionUser {
    const { password: _password, ...sessionUser } = user as AppUser;
    return sessionUser;
  },

  canAccess(role: UserRole, pageRoles: UserRole[]): boolean {
    return pageRoles.includes(role);
  },
};

export type { SessionUser };
