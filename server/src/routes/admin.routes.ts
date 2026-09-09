import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
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

// GET /api/admin/users - List all users with contact counts
router.get('/users', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
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

    res.json({ success: true, users });
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

    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      res.status(409).json({ success: false, message: 'An account with this email already exists.' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
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

    await logAuditEvent({
      userId: req.user!.id,
      action: 'USER_CREATED',
      entityType: 'USER',
      entityId: newUser.id,
      details: { name: newUser.name, email: newUser.email, role: newUser.role, isActive: newUser.isActive },
      ipAddress: req.ip,
    });

    res.status(201).json({ success: true, user: newUser, message: 'User created successfully.' });
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

    const existingUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!existingUser) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    const { name, email, password, role, isActive } = parseResult.data;
    const updateData: any = {};

    if (name !== undefined) updateData.name = name.trim();
    if (role !== undefined) updateData.role = role;
    if (isActive !== undefined) updateData.isActive = isActive;

    if (email !== undefined) {
      const normalizedEmail = email.toLowerCase().trim();
      if (normalizedEmail !== existingUser.email) {
        const emailTaken = await prisma.user.findUnique({ where: { email: normalizedEmail } });
        if (emailTaken) {
          res.status(409).json({ success: false, message: 'This email is already in use by another account.' });
          return;
        }
        updateData.email = normalizedEmail;
      }
    }

    if (password && password.trim().length >= 6) {
      updateData.password = await bcrypt.hash(password.trim(), 10);
    }

    const updatedUser = await prisma.user.update({
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
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update user.' });
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

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true },
    });

    if (!targetUser) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    await prisma.user.delete({ where: { id: userId } });

    await logAuditEvent({
      userId: req.user!.id,
      action: 'USER_DELETED',
      entityType: 'USER',
      entityId: targetUser.id,
      details: { deletedEmail: targetUser.email, deletedName: targetUser.name, role: targetUser.role },
      ipAddress: req.ip,
    });

    res.json({ success: true, message: `User "${targetUser.name}" has been permanently deleted.` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete user.' });
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
    const targetUser = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, name: true, email: true, role: true },
    });

    await logAuditEvent({
      userId: req.user!.id,
      action: 'USER_ROLE_CHANGED',
      entityType: 'USER',
      entityId: targetUser.id,
      details: { newRole: role, targetEmail: targetUser.email },
      ipAddress: req.ip,
    });

    res.json({ success: true, user: targetUser });
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
    const targetUser = await prisma.user.update({
      where: { id: userId },
      data: { isActive },
      select: { id: true, name: true, email: true, isActive: true },
    });

    await logAuditEvent({
      userId: req.user!.id,
      action: isActive ? 'USER_ACTIVATED' : 'USER_SUSPENDED',
      entityType: 'USER',
      entityId: targetUser.id,
      details: { isActive, targetEmail: targetUser.email },
      ipAddress: req.ip,
    });

    res.json({ success: true, user: targetUser });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update user status.' });
  }
});

// GET /api/admin/audit-logs - Query audit trail
router.get('/audit-logs', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { limit = '50', action, entityType } = req.query;
    const take = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 50));

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
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch audit logs.' });
  }
});

// GET /api/admin/stats - System-wide metrics
router.get('/stats', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [totalUsers, totalContacts, totalImports, totalAuditLogs, statusBreakdown, sourceBreakdown] =
      await Promise.all([
        prisma.user.count(),
        prisma.contact.count(),
        prisma.importBatch.count(),
        prisma.auditLog.count(),
        prisma.contact.groupBy({
          by: ['status'],
          _count: { id: true },
        }),
        prisma.contact.groupBy({
          by: ['source'],
          _count: { id: true },
        }),
      ]);

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalContacts,
        totalImports,
        totalAuditLogs,
        statusBreakdown: statusBreakdown.map((s) => ({ status: s.status, count: s._count.id })),
        sourceBreakdown: sourceBreakdown.map((s) => ({ source: s.source, count: s._count.id })),
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
