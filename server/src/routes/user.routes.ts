import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import supabase from '../config/supabase';
import prisma from '../config/prisma';
import { logAuditEvent } from '../services/audit.service';

const router = Router();

// Validation Schemas
const createUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['USER', 'ADMIN']).default('USER'),
  avatar: z.string().optional(),
  isActive: z.boolean().default(true),
});

const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  role: z.enum(['USER', 'ADMIN']).optional(),
  avatar: z.string().optional(),
  isActive: z.boolean().optional(),
});

/**
 * Helper to ensure a user is also synced with local Prisma if reachable
 */
async function syncPrismaSafe(action: () => Promise<any>) {
  try {
    await action();
  } catch (err: any) {
    console.warn('Prisma sync skipped/error:', err.message);
  }
}

/**
 * GET /api/users/test-connection
 * Check Supabase connection and table readiness
 */
router.get('/test-connection', async (_req: Request, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabase.from('users').select('id, email, name, role').limit(1);

    if (error) {
      res.status(500).json({
        success: false,
        message: 'Supabase table query failed.',
        supabaseError: error,
        hint: 'Please ensure the "users" table exists in your Supabase SQL Editor.',
      });
      return;
    }

    res.json({
      success: true,
      message: 'Supabase Database connected successfully!',
      sample: data,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to connect to Supabase.',
      error: error.message,
    });
  }
});

/**
 * GET /api/users
 * Retrieve all users from Supabase DB
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { search, role, page = '1', limit = '50' } = req.query;
    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const take = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 50));
    const offset = (pageNum - 1) * take;

    let query = supabase
      .from('users')
      .select('id, name, email, role, avatar, isActive, createdAt, updatedAt', { count: 'exact' });

    if (role && (role === 'USER' || role === 'ADMIN')) {
      query = query.eq('role', role);
    }

    if (search && typeof search === 'string') {
      const s = search.trim();
      query = query.or(`name.ilike.%${s}%,email.ilike.%${s}%`);
    }

    const { data: users, count, error } = await query
      .order('createdAt', { ascending: false })
      .range(offset, offset + take - 1);

    if (error) {
      // If table query in Supabase fails, try fallback to Prisma
      try {
        const whereClause: any = {};
        if (role && (role === 'USER' || role === 'ADMIN')) whereClause.role = role;
        if (search && typeof search === 'string') {
          whereClause.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ];
        }

        const [pUsers, pTotal] = await Promise.all([
          prisma.user.findMany({
            where: whereClause,
            select: { id: true, name: true, email: true, role: true, avatar: true, isActive: true, createdAt: true, updatedAt: true },
            skip: offset,
            take,
            orderBy: { createdAt: 'desc' },
          }),
          prisma.user.count({ where: whereClause }),
        ]);

        res.json({
          success: true,
          users: pUsers,
          pagination: {
            page: pageNum,
            limit: take,
            total: pTotal,
            totalPages: Math.ceil(pTotal / take),
          },
          source: 'prisma',
        });
        return;
      } catch (prismaErr) {
        res.status(500).json({
          success: false,
          message: 'Error fetching users from Supabase database.',
          error,
        });
        return;
      }
    }

    res.json({
      success: true,
      users: users || [],
      pagination: {
        page: pageNum,
        limit: take,
        total: count || (users ? users.length : 0),
        totalPages: Math.ceil((count || (users ? users.length : 0)) / take),
      },
      source: 'supabase',
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Server error retrieving users.', error: error.message });
  }
});

/**
 * GET /api/users/:id
 * Retrieve a specific user by ID from Supabase
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);

    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, role, avatar, isActive, createdAt, updatedAt')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      // Fallback to Prisma
      try {
        const pUser = await prisma.user.findUnique({
          where: { id },
          select: { id: true, name: true, email: true, role: true, avatar: true, isActive: true, createdAt: true, updatedAt: true },
        });
        if (!pUser) {
          res.status(404).json({ success: false, message: 'User not found.' });
          return;
        }
        res.json({ success: true, user: pUser, source: 'prisma' });
        return;
      } catch {
        res.status(500).json({ success: false, message: 'Failed to fetch user.', error });
        return;
      }
    }

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found in Supabase.' });
      return;
    }

    res.json({ success: true, user, source: 'supabase' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Server error.', error: error.message });
  }
});

/**
 * POST /api/users (or /api/users/create)
 * Create a new user directly in Supabase DB
 */
router.post(['/', '/create'], async (req: Request, res: Response): Promise<void> => {
  try {
    const parseResult = createUserSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ success: false, errors: parseResult.error.flatten().fieldErrors });
      return;
    }

    const { name, email, password, role, avatar, isActive } = parseResult.data;
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Check if user already exists in Supabase
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existingUser) {
      res.status(409).json({ success: false, message: 'An account with this email already exists in Supabase.' });
      return;
    }

    // 2. Hash password & prepare payload
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = crypto.randomUUID();
    const now = new Date().toISOString();

    const newUserData = {
      id: userId,
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: role || 'USER',
      avatar: avatar || null,
      isActive: isActive !== undefined ? isActive : true,
      createdAt: now,
      updatedAt: now,
    };

    // 3. Insert into Supabase
    const { data: insertedUser, error: insertError } = await supabase
      .from('users')
      .insert(newUserData)
      .select('id, name, email, role, avatar, isActive, createdAt, updatedAt')
      .single();

    if (insertError) {
      console.error('Supabase user insert error:', insertError);
      try {
        const pUser = await prisma.user.create({
          data: {
            id: userId,
            name: name.trim(),
            email: normalizedEmail,
            password: hashedPassword,
            role: role || 'USER',
            avatar: avatar || null,
            isActive: isActive !== undefined ? isActive : true,
          },
          select: { id: true, name: true, email: true, role: true, avatar: true, isActive: true, createdAt: true, updatedAt: true },
        });

        res.status(201).json({
          success: true,
          message: 'User created successfully in database (Prisma)!',
          user: pUser,
        });
        return;
      } catch (prismaErr: any) {
        res.status(500).json({
          success: false,
          message: 'Failed to create user in Supabase.',
          error: insertError.message || insertError,
        });
        return;
      }
    }

    // 4. Safe sync to Prisma (optional background)
    syncPrismaSafe(() =>
      prisma.user.upsert({
        where: { email: normalizedEmail },
        update: {},
        create: {
          id: userId,
          name: name.trim(),
          email: normalizedEmail,
          password: hashedPassword,
          role: role || 'USER',
          avatar: avatar || null,
          isActive: isActive !== undefined ? isActive : true,
        },
      })
    );

    // 5. Audit log
    try {
      await logAuditEvent({
        userId,
        action: 'USER_CREATE',
        entityType: 'USER',
        entityId: userId,
        details: { email: normalizedEmail, role, createdVia: 'Supabase DB' },
        ipAddress: req.ip,
      });
    } catch (_) {}

    res.status(201).json({
      success: true,
      message: 'User created successfully in Supabase DB!',
      user: insertedUser,
    });
  } catch (error: any) {
    console.error('Create user error:', error);
    res.status(500).json({ success: false, message: 'Server error while creating user.', error: error.message });
  }
});

/**
 * PUT /api/users/:id or PATCH /api/users/:id
 * Update user in Supabase DB
 */
router.all(['/:id', '/update/:id'], async (req: Request, res: Response): Promise<void> => {
  if (req.method !== 'PUT' && req.method !== 'PATCH') {
    res.status(405).json({ success: false, message: 'Method not allowed' });
    return;
  }

  try {
    const id = String(req.params.id);
    const parseResult = updateUserSchema.safeParse(req.body);

    if (!parseResult.success) {
      res.status(400).json({ success: false, errors: parseResult.error.flatten().fieldErrors });
      return;
    }

    const updateData: any = {
      updatedAt: new Date().toISOString(),
    };

    if (parseResult.data.name !== undefined) updateData.name = parseResult.data.name.trim();
    if (parseResult.data.email !== undefined) updateData.email = parseResult.data.email.toLowerCase().trim();
    if (parseResult.data.role !== undefined) updateData.role = parseResult.data.role;
    if (parseResult.data.avatar !== undefined) updateData.avatar = parseResult.data.avatar;
    if (parseResult.data.isActive !== undefined) updateData.isActive = parseResult.data.isActive;
    if (parseResult.data.password) {
      updateData.password = await bcrypt.hash(parseResult.data.password, 10);
    }

    // 1. Update in Supabase
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', id)
      .select('id, name, email, role, avatar, isActive, createdAt, updatedAt')
      .maybeSingle();

    if (updateError || !updatedUser) {
      // Fallback to Prisma
      try {
        const pUpdated = await prisma.user.update({
          where: { id },
          data: updateData,
          select: { id: true, name: true, email: true, role: true, avatar: true, isActive: true, createdAt: true, updatedAt: true },
        });

        res.json({
          success: true,
          message: 'User updated successfully (Prisma)!',
          user: pUpdated,
        });
        return;
      } catch (prismaErr) {
        res.status(500).json({
          success: false,
          message: 'Failed to update user in Supabase.',
          error: updateError,
        });
        return;
      }
    }

    // 2. Safe sync to Prisma
    syncPrismaSafe(() =>
      prisma.user.update({
        where: { id },
        data: updateData,
      })
    );

    res.json({
      success: true,
      message: 'User updated successfully in Supabase DB!',
      user: updatedUser,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Server error while updating user.', error: error.message });
  }
});

/**
 * DELETE /api/users/:id
 * Delete a user from Supabase DB
 */
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);

    // 1. Delete in Supabase
    const { error: deleteError } = await supabase
      .from('users')
      .delete()
      .eq('id', id);

    if (deleteError) {
      // Fallback to Prisma
      try {
        await prisma.user.delete({ where: { id } });
        res.json({ success: true, message: 'User deleted successfully (Prisma).' });
        return;
      } catch (prismaErr) {
        res.status(500).json({
          success: false,
          message: 'Failed to delete user from Supabase.',
          error: deleteError,
        });
        return;
      }
    }

    // 2. Safe sync delete to Prisma
    syncPrismaSafe(() => prisma.user.delete({ where: { id } }));

    res.json({
      success: true,
      message: 'User deleted successfully from Supabase DB!',
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Server error while deleting user.', error: error.message });
  }
});

export default router;
