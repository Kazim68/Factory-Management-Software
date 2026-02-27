import { storage } from './storage';
import type { AppUser, UserRole } from '../types';

const USERS_KEY = 'factory_users';
const SESSION_KEY = 'factory_session';

type SessionUser = Omit<AppUser, 'password'>;

const normalizeUsername = (username: string) => username.trim().toLowerCase();

export const auth = {
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
    return this.toSessionUser(user);
  },

  logout(): void {
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
