import bcrypt from 'bcryptjs';

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: 'USER' | 'ADMIN';
  avatar?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
  _count?: {
    contacts: number;
    imports: number;
  };
}

// Pre-populate with standard initial users
const initialUsers: UserRecord[] = [
  {
    id: 'admin-demo-id',
    name: 'System Administrator',
    email: 'admin@datahub.local',
    password: '', // hashed or demo
    role: 'ADMIN',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    isActive: true,
    createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
    updatedAt: new Date().toISOString(),
    _count: { contacts: 412, imports: 8 },
  },
  {
    id: 'user-demo-id',
    name: 'Aadil Khan',
    email: 'user@datahub.local',
    password: '',
    role: 'USER',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    isActive: true,
    createdAt: new Date(Date.now() - 86400000 * 14).toISOString(),
    updatedAt: new Date().toISOString(),
    _count: { contacts: 872, imports: 12 },
  },
  {
    id: 'user-demo-2',
    name: 'David Miller',
    email: 'dmiller@enterprise.com',
    password: '',
    role: 'USER',
    avatar: null,
    isActive: false,
    createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
    updatedAt: new Date().toISOString(),
    _count: { contacts: 0, imports: 0 },
  },
];

// In-memory persistent registry during server uptime
const userCache: Map<string, UserRecord> = new Map();

// Initialize cache with default entries
initialUsers.forEach((u) => {
  userCache.set(u.id, u);
  userCache.set(u.email.toLowerCase(), u);
});

export const UserStore = {
  getAll(): UserRecord[] {
    const uniqueMap = new Map<string, UserRecord>();
    userCache.forEach((user) => {
      uniqueMap.set(user.id, user);
    });
    return Array.from(uniqueMap.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  },

  getById(id: string): UserRecord | undefined {
    return userCache.get(id);
  },

  getByEmail(email: string): UserRecord | undefined {
    return userCache.get(email.toLowerCase().trim());
  },

  add(user: UserRecord): UserRecord {
    const normalizedEmail = user.email.toLowerCase().trim();
    const record: UserRecord = {
      ...user,
      email: normalizedEmail,
      _count: user._count || { contacts: 0, imports: 0 },
    };
    userCache.set(record.id, record);
    userCache.set(normalizedEmail, record);
    return record;
  },

  update(id: string, updates: Partial<UserRecord>): UserRecord | undefined {
    let existing = userCache.get(id);
    if (!existing) {
      // Try by email if id was not found
      for (const u of userCache.values()) {
        if (u.id === id) {
          existing = u;
          break;
        }
      }
    }

    if (!existing) return undefined;

    const oldEmail = existing.email.toLowerCase();
    const newEmail = (updates.email || existing.email).toLowerCase().trim();

    if (oldEmail !== newEmail) {
      userCache.delete(oldEmail);
    }

    const updated: UserRecord = {
      ...existing,
      ...updates,
      email: newEmail,
      updatedAt: new Date().toISOString(),
    };

    userCache.set(updated.id, updated);
    userCache.set(newEmail, updated);
    return updated;
  },

  delete(id: string): boolean {
    const existing = userCache.get(id);
    if (!existing) return false;

    userCache.delete(id);
    userCache.delete(existing.email.toLowerCase());
    return true;
  },
};
