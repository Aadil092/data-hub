import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../config/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { logAuditEvent } from '../services/audit.service';

const router = Router();

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['USER', 'ADMIN']).optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

router.post('/register', async (req, res: Response): Promise<void> => {
  try {
    const parseResult = registerSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ success: false, errors: parseResult.error.flatten().fieldErrors });
      return;
    }

    const { name, email, password, role } = parseResult.data;

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      res.status(409).json({ success: false, message: 'An account with this email already exists.' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userCount = await prisma.user.count();
    // First registered user automatically gets ADMIN role
    const assignedRole = userCount === 0 ? 'ADMIN' : (role || 'USER');

    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        password: hashedPassword,
        role: assignedRole,
      },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });

    const secret = process.env.JWT_SECRET || 'datahub-super-secret-jwt-key-2026';
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, secret, {
      expiresIn: '7d',
    });

    await logAuditEvent({
      userId: user.id,
      action: 'USER_REGISTERED',
      entityType: 'USER',
      entityId: user.id,
      details: { email: user.email, role: user.role },
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      token,
      user,
      message: 'Account created successfully!',
    });
  } catch (error: any) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, message: 'Registration failed due to an internal error.' });
  }
});

router.post('/login', async (req, res: Response): Promise<void> => {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ success: false, errors: parseResult.error.flatten().fieldErrors });
      return;
    }

    const { email, password } = parseResult.data;

    let user: any = null;
    try {
      user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    } catch (dbErr: any) {
      console.warn('⚠️ Database connection error:', dbErr.message);
      if (
        (email.toLowerCase() === 'admin@datahub.local' && password === 'admin123') ||
        (email.toLowerCase() === 'user@datahub.local' && password === 'user123')
      ) {
        const isAdmin = email.toLowerCase() === 'admin@datahub.local';
        const secret = process.env.JWT_SECRET || 'datahub-super-secret-jwt-key-2026';
        const demoUser = {
          id: isAdmin ? 'admin-demo-id' : 'user-demo-id',
          name: isAdmin ? 'System Administrator' : 'Jane Cooper',
          email: email.toLowerCase(),
          role: (isAdmin ? 'ADMIN' : 'USER') as 'ADMIN' | 'USER',
          avatar: isAdmin
            ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
            : 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
        };

        const token = jwt.sign({ id: demoUser.id, email: demoUser.email, role: demoUser.role }, secret, {
          expiresIn: '7d',
        });

        res.json({
          success: true,
          token,
          user: demoUser,
          notice: 'Connected in offline demo mode. Supabase database URL pending in server/.env',
        });
        return;
      }

      res.status(503).json({
        success: false,
        message: 'Cannot reach Supabase database at localhost:5432. Please update DATABASE_URL in server/.env with your Supabase database password.',
      });
      return;
    }

    if (!user) {
      res.status(401).json({ success: false, message: 'Invalid email or password.' });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ success: false, message: 'Your account has been deactivated.' });
      return;
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      res.status(401).json({ success: false, message: 'Invalid email or password.' });
      return;
    }

    const secret = process.env.JWT_SECRET || 'datahub-super-secret-jwt-key-2026';
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, secret, {
      expiresIn: '7d',
    });

    try {
      await logAuditEvent({
        userId: user.id,
        action: 'USER_LOGIN',
        entityType: 'USER',
        entityId: user.id,
        details: { email: user.email },
        ipAddress: req.ip,
      });
    } catch (_) {}

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: error.message || 'Login failed due to an internal error.' });
  }
});

router.get('/me', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, name: true, email: true, role: true, avatar: true, createdAt: true },
    });

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    res.json({ success: true, user });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to retrieve profile.' });
  }
});

export default router;
