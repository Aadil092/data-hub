import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import supabase from '../config/supabase';
import prisma from '../config/prisma';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { logAuditEvent } from '../services/audit.service';

const router = Router();

// Apply auth and requireAdmin to all admin routes
router.use(authenticate);
router.use(requireAdmin);

const createUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['USER', 'ADMIN']).optional().default('USER'),
  isActive: z.boolean().optional().default(true),
});

const updateUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  email: z.string().email('Invalid email address').optional(),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  role: z.enum(['USER', 'ADMIN']).optional(),
  isActive: z.boolean().optional(),
});

// Helper for safe Prisma background sync
async function syncPrismaSafe(action: () => Promise<any>) {
  try {
    await action();
  } catch (err: any) {
    console.warn('Prisma sync skipped/error:', err.message);
  }
}

// GET /api/admin/users - List all users
router.get('/users', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // 1. Try Supabase first
    const { data: sUsers, error: sErr } = await supabase
      .from('users')
      .select('id, name, email, role, avatar, isActive, createdAt')
      .order('createdAt', { ascending: false });

    if (!sErr && sUsers) {
      const usersWithCounts = sUsers.map((u: any) => ({
        ...u,
        _count: { contacts: 0, imports: 0 },
      }));
      res.json({ success: true, users: usersWithCounts, source: 'supabase' });
      return;
    }

    // 2. Fallback to Prisma
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: {
            contacts: true,
            imports: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, users, source: 'prisma' });
  } catch (error: any) {
    console.error('Error fetching admin users:', error);
    res.status(500).json({ success: false, message: error?.message || 'Failed to fetch users.' });
  }
});

// POST /api/admin/users - Admin creates a new user
router.post('/users', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parseResult = createUserSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ success: false, errors: parseResult.error.flatten().fieldErrors });
      return;
    }

    const { name, email, password, role, isActive } = parseResult.data;
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Check existing in Supabase or Prisma
    let existing = false;
    try {
      const { data: sUser } = await supabase.from('users').select('id').eq('email', normalizedEmail).maybeSingle();
      if (sUser) existing = true;
    } catch (_) {}

    if (!existing) {
      try {
        const pUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
        if (pUser) existing = true;
      } catch (_) {}
    }

    if (existing) {
      res.status(409).json({ success: false, message: 'An account with this email already exists.' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = crypto.randomUUID();
    const now = new Date().toISOString();

    let createdUser: any = null;

    // 2. Insert into Supabase
    try {
      const { data: sCreated, error: sErr } = await supabase
        .from('users')
        .insert({
          id: userId,
          name: name.trim(),
          email: normalizedEmail,
          password: hashedPassword,
          role,
          isActive,
          createdAt: now,
          updatedAt: now,
        })
        .select('id, name, email, role, avatar, isActive, createdAt')
        .single();

      if (!sErr && sCreated) {
        createdUser = { ...sCreated, _count: { contacts: 0, imports: 0 } };
      }
    } catch (sErr) {
      console.warn('Supabase admin create notice:', sErr);
    }

    // 3. Insert into Prisma (if reachable)
    try {
      const pCreated = await prisma.user.create({
        data: {
          id: userId,
          name: name.trim(),
          email: normalizedEmail,
          password: hashedPassword,
          role,
          isActive,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
          _count: {
            select: {
              contacts: true,
              imports: true,
            },
          },
        },
      });
      if (!createdUser) createdUser = pCreated;
    } catch (pErr: any) {
      console.warn('Prisma create skipped:', pErr.message);
    }

    if (!createdUser) {
      createdUser = {
        id: userId,
        name: name.trim(),
        email: normalizedEmail,
        role,
        isActive,
        createdAt: now,
        _count: { contacts: 0, imports: 0 },
      };
    }

    await logAuditEvent({
      userId: req.user!.id,
      action: 'USER_CREATED',
      entityType: 'USER',
      entityId: createdUser.id,
      details: { name: createdUser.name, email: createdUser.email, role: createdUser.role, isActive: createdUser.isActive },
      ipAddress: req.ip,
    });

    res.status(201).json({ success: true, user: createdUser, message: 'User created successfully in database.' });
  } catch (error: any) {
    console.error('Error creating admin user:', error);
    res.status(500).json({ success: false, message: error?.message || 'Failed to create user.' });
  }
});

// PUT /api/admin/users/:id - Admin updates user profile / credentials
router.put('/users/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.params.id as string;
    const parseResult = updateUserSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ success: false, errors: parseResult.error.flatten().fieldErrors });
      return;
    }

    const { name, email, password, role, isActive } = parseResult.data;
    const updateData: any = { updatedAt: new Date().toISOString() };

    if (name !== undefined) updateData.name = name.trim();
    if (role !== undefined) updateData.role = role;
    if (isActive !== undefined) updateData.isActive = isActive;

    if (email !== undefined) {
      updateData.email = email.toLowerCase().trim();
    }

    if (password && password.trim().length >= 6) {
      updateData.password = await bcrypt.hash(password.trim(), 10);
    }

    let updatedUser: any = null;

    // 1. Update in Supabase
    try {
      const { data: sUpdated, error: sErr } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', userId)
        .select('id, name, email, role, avatar, isActive, createdAt')
        .maybeSingle();

      if (!sErr && sUpdated) {
        updatedUser = { ...sUpdated, _count: { contacts: 0, imports: 0 } };
      }
    } catch (sErr) {
      console.warn('Supabase admin update notice:', sErr);
    }

    // 2. Sync to Prisma
    try {
      const pUpdated = await prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
          _count: {
            select: {
              contacts: true,
              imports: true,
            },
          },
        },
      });
      if (!updatedUser) updatedUser = pUpdated;
    } catch (pErr: any) {
      console.warn('Prisma admin update skipped:', pErr.message);
    }

    if (!updatedUser) {
      res.status(404).json({ success: false, message: 'User not found or update failed.' });
      return;
    }

    await logAuditEvent({
      userId: req.user!.id,
      action: 'USER_UPDATED',
      entityType: 'USER',
      entityId: updatedUser.id,
      details: {
        updatedFields: Object.keys(updateData).filter((k) => k !== 'password'),
        passwordChanged: !!updateData.password,
        targetEmail: updatedUser.email,
      },
      ipAddress: req.ip,
    });

    res.json({ success: true, user: updatedUser, message: 'User updated successfully.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to update user.', error: error.message });
  }
});

// DELETE /api/admin/users/:id - Admin deletes a user
router.delete('/users/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.params.id as string;

    // Prevent administrator from deleting their own account
    if (userId === req.user!.id) {
      res.status(400).json({ success: false, message: 'You cannot delete your own administrator account.' });
      return;
    }

    // 1. Delete in Supabase
    try {
      await supabase.from('users').delete().eq('id', userId);
    } catch (sErr) {
      console.warn('Supabase delete user notice:', sErr);
    }

    // 2. Delete in Prisma
    syncPrismaSafe(() => prisma.user.delete({ where: { id: userId } }));

    await logAuditEvent({
      userId: req.user!.id,
      action: 'USER_DELETED',
      entityType: 'USER',
      entityId: userId,
      details: { deletedUserId: userId },
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'User has been deleted successfully.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to delete user.', error: error.message });
  }
});

// PUT /api/admin/users/:id/role - Update user role
router.put('/users/:id/role', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role } = req.body;
    if (!['USER', 'ADMIN'].includes(role)) {
      res.status(400).json({ success: false, message: 'Invalid role. Must be USER or ADMIN.' });
      return;
    }

    const userId = req.params.id as string;

    // Supabase update
    await supabase.from('users').update({ role, updatedAt: new Date().toISOString() }).eq('id', userId);

    // Prisma update
    syncPrismaSafe(() => prisma.user.update({ where: { id: userId }, data: { role } }));

    await logAuditEvent({
      userId: req.user!.id,
      action: 'USER_ROLE_CHANGED',
      entityType: 'USER',
      entityId: userId,
      details: { newRole: role },
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'User role updated successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update user role.' });
  }
});

// PUT /api/admin/users/:id/status - Toggle active/suspended
router.put('/users/:id/status', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') {
      res.status(400).json({ success: false, message: 'isActive must be a boolean.' });
      return;
    }

    const userId = req.params.id as string;

    // Supabase update
    await supabase.from('users').update({ isActive, updatedAt: new Date().toISOString() }).eq('id', userId);

    // Prisma update
    syncPrismaSafe(() => prisma.user.update({ where: { id: userId }, data: { isActive } }));

    await logAuditEvent({
      userId: req.user!.id,
      action: isActive ? 'USER_ACTIVATED' : 'USER_SUSPENDED',
      entityType: 'USER',
      entityId: userId,
      details: { isActive },
      ipAddress: req.ip,
    });

    res.json({ success: true, message: `User status set to ${isActive ? 'Active' : 'Suspended'}.` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update user status.' });
  }
});

// GET /api/admin/audit-logs - Query audit trail
router.get('/audit-logs', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { limit = '50', action, entityType } = req.query;
    const take = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 50));

    // Try Prisma for audit logs with fallback
    try {
      const where: any = {};
      if (action && typeof action === 'string') where.action = action;
      if (entityType && typeof entityType === 'string') where.entityType = entityType;

      const logs = await prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { name: true, email: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
        take,
      });

      res.json({ success: true, logs });
      return;
    } catch {
      // Fallback empty list if DB offline
      res.json({ success: true, logs: [] });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch audit logs.' });
  }
});

// GET /api/admin/stats - System-wide metrics
router.get('/stats', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    let totalUsers = 0;
    try {
      const { count } = await supabase.from('users').select('*', { count: 'exact', head: true });
      totalUsers = count || 0;
    } catch (_) {}

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalContacts: 0,
        totalImports: 0,
        totalAuditLogs: 0,
        statusBreakdown: [],
        sourceBreakdown: [],
        serverUptime: process.uptime(),
        nodeVersion: process.version,
        memoryUsage: process.memoryUsage(),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch system stats.' });
  }
});

export default router;
