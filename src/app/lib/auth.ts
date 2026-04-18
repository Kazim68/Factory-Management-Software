import { storage } from "./storage";
import type { AppUser, AuditLog, UserRole } from "../types";

const USERS_KEY = "factory_users";
const SESSION_KEY = "factory_session";
const AUDIT_LOGS_KEY = "factory_audit_logs";

type SessionUser = Omit<AppUser, "password">;

const normalizeUsername = (username: string) => username.trim().toLowerCase();
const PRIVILEGED_ROLES = new Set<UserRole>(["admin", "super_admin"]);

const normalizeRole = (role: unknown): UserRole => {
  const normalized = String(role ?? "")
    .trim()
    .toLowerCase();
  if (normalized === "admin") return "admin";
  if (normalized === "super_admin" || normalized === "super admin")
    return "super_admin";
  if (normalized === "munshi") return "sub_admin";
  return "sub_admin";
};

const normalizeStoredUser = (user: AppUser): AppUser => ({
  ...user,
  role: normalizeRole(user.role),
  isActive: user.isActive ?? true,
});

const formatRoleLabel = (role: UserRole): string => {
  if (role === "super_admin") return "Super Admin";
  if (role === "sub_admin") return "Sub Admin";
  return "Admin";
};

export const auth = {
  listAuditLogs(): AuditLog[] {
    return storage
      .get<AuditLog>(AUDIT_LOGS_KEY)
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );
  },

  logAction(entry: Omit<AuditLog, "id" | "timestamp">): void {
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
    const users = storage.get<AppUser>(USERS_KEY).map(normalizeStoredUser);
    if (users.length > 0) {
      storage.set<AppUser>(USERS_KEY, users);
      const session = this.getSessionUser();
      if (session) {
        this.setSessionUser(session);
      }
      return;
    }

    storage.set<AppUser>(USERS_KEY, [
      {
        id: crypto.randomUUID(),
        name: "System Admin",
        username: "admin",
        password: "admin123",
        role: "admin",
        isActive: true,
        createdAt: new Date().toISOString(),
      },
    ]);
  },

  listUsers(): AppUser[] {
    const users = storage.get<AppUser>(USERS_KEY).map(normalizeStoredUser);
    storage.set<AppUser>(USERS_KEY, users);
    return users;
  },

  createUser(user: Omit<AppUser, "id" | "createdAt">): AppUser {
    const users = this.listUsers();
    const normalized = normalizeUsername(user.username);
    if (
      users.some(
        (existing) => normalizeUsername(existing.username) === normalized,
      )
    ) {
      throw new Error("Username already exists");
    }

    const newUser: AppUser = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      ...user,
      role: normalizeRole(user.role),
      username: user.username.trim(),
      isActive: true,
    };
    storage.set<AppUser>(USERS_KEY, [...users, newUser]);

    const session = this.getSessionUser();
    this.logAction({
      actorId: session?.id,
      actorName: session?.name ?? "System",
      action: "User Created",
      targetUserId: newUser.id,
      targetUserName: newUser.name,
      detail: `${newUser.username} (${newUser.role})`,
    });

    return newUser;
  },

  updateUser(
    id: string,
    updates: Partial<Pick<AppUser, "name" | "username" | "password" | "role">>,
  ): AppUser {
    const users = this.listUsers();
    const index = users.findIndex((user) => user.id === id);

    if (index === -1) {
      throw new Error("User not found");
    }

    if (updates.username) {
      const normalized = normalizeUsername(updates.username);
      const duplicate = users.some(
        (user) =>
          user.id !== id && normalizeUsername(user.username) === normalized,
      );
      if (duplicate) {
        throw new Error("Username already exists");
      }
    }

    const updatedUser = {
      ...users[index],
      ...updates,
      role: updates.role ? normalizeRole(updates.role) : users[index].role,
      username: updates.username
        ? updates.username.trim()
        : users[index].username,
    };

    users[index] = updatedUser;
    storage.set<AppUser>(USERS_KEY, users);

    const session = this.getSessionUser();
    if (session?.id === id) {
      this.setSessionUser(updatedUser);
    }

    this.logAction({
      actorId: session?.id,
      actorName: session?.name ?? "System",
      action: "User Updated",
      targetUserId: updatedUser.id,
      targetUserName: updatedUser.name,
      detail: `${updatedUser.username} (${updatedUser.role})`,
    });

    return updatedUser;
  },

  deactivateUser(id: string): void {
    const users = this.listUsers();
    const targetUser = users.find((user) => user.id === id);

    if (!targetUser) {
      throw new Error("User not found");
    }

    if (PRIVILEGED_ROLES.has(normalizeRole(targetUser.role))) {
      const privilegedCount = users.filter(
        (user) =>
          user.isActive && PRIVILEGED_ROLES.has(normalizeRole(user.role)),
      ).length;
      if (privilegedCount <= 1) {
        throw new Error(
          "At least one active admin or super admin user is required",
        );
      }
    }

    if (!targetUser.isActive) {
      return;
    }

    const nextUsers = users.map((user) =>
      user.id === id ? { ...user, isActive: false } : user,
    );
    storage.set<AppUser>(USERS_KEY, nextUsers);

    const session = this.getSessionUser();
    if (session?.id === id) {
      this.logout();
    }

    this.logAction({
      actorId: session?.id,
      actorName: session?.name ?? "System",
      action: "User Deactivated",
      targetUserId: targetUser.id,
      targetUserName: targetUser.name,
      detail: `${targetUser.username} (${targetUser.role})`,
    });
  },

  reactivateUser(id: string): void {
    const users = this.listUsers();
    const targetUser = users.find((user) => user.id === id);

    if (!targetUser) {
      throw new Error("User not found");
    }

    if (targetUser.isActive) {
      return;
    }

    const nextUsers = users.map((user) =>
      user.id === id ? { ...user, isActive: true } : user,
    );
    storage.set<AppUser>(USERS_KEY, nextUsers);

    const session = this.getSessionUser();
    this.logAction({
      actorId: session?.id,
      actorName: session?.name ?? "System",
      action: "User Reactivated",
      targetUserId: targetUser.id,
      targetUserName: targetUser.name,
      detail: `${targetUser.username} (${targetUser.role})`,
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
      throw new Error("Invalid username or password");
    }

    if (!user.isActive) {
      throw new Error(
        "Your account has been deactivated. Please contact an admin.",
      );
    }

    this.setSessionUser(user);
    this.logAction({
      actorId: user.id,
      actorName: user.name,
      action: "User Login",
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
        action: "User Logout",
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
      if (!raw) return null;
      const sessionUser = JSON.parse(raw) as SessionUser;
      return {
        ...sessionUser,
        role: normalizeRole(sessionUser.role),
      };
    } catch {
      return null;
    }
  },

  setSessionUser(user: AppUser | SessionUser): void {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        ...this.toSessionUser(user),
        role: normalizeRole(user.role),
      }),
    );
  },

  toSessionUser(user: AppUser | SessionUser): SessionUser {
    const { password: _password, ...sessionUser } = user as AppUser;
    return sessionUser;
  },

  canAccess(role: UserRole, pageRoles: UserRole[]): boolean {
    if (PRIVILEGED_ROLES.has(role)) {
      return true;
    }
    return pageRoles.includes(role);
  },

  formatRoleLabel,
};

export type { SessionUser };
