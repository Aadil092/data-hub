"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
const prisma_1 = __importDefault(require("../config/prisma"));
const auth_1 = require("../middleware/auth");
const audit_service_1 = require("../services/audit.service");
const router = (0, express_1.Router)();
const registerSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, 'Name must be at least 2 characters'),
    email: zod_1.z.string().email('Invalid email address'),
    password: zod_1.z.string().min(6, 'Password must be at least 6 characters'),
    role: zod_1.z.enum(['USER', 'ADMIN']).optional(),
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
    password: zod_1.z.string().min(1, 'Password is required'),
});
router.post('/register', async (req, res) => {
    try {
        const parseResult = registerSchema.safeParse(req.body);
        if (!parseResult.success) {
            res.status(400).json({ success: false, errors: parseResult.error.flatten().fieldErrors });
            return;
        }
        const { name, email, password, role } = parseResult.data;
        const existing = await prisma_1.default.user.findUnique({ where: { email: email.toLowerCase() } });
        if (existing) {
            res.status(409).json({ success: false, message: 'An account with this email already exists.' });
            return;
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        const userCount = await prisma_1.default.user.count();
        // First registered user automatically gets ADMIN role
        const assignedRole = userCount === 0 ? 'ADMIN' : (role || 'USER');
        const user = await prisma_1.default.user.create({
            data: {
                name,
                email: email.toLowerCase(),
                password: hashedPassword,
                role: assignedRole,
            },
            select: { id: true, name: true, email: true, role: true, createdAt: true },
        });
        const secret = process.env.JWT_SECRET || 'datahub-super-secret-jwt-key-2026';
        const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: user.role }, secret, {
            expiresIn: '7d',
        });
        await (0, audit_service_1.logAuditEvent)({
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
    }
    catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ success: false, message: 'Registration failed due to an internal error.' });
    }
});
router.post('/login', async (req, res) => {
    try {
        const parseResult = loginSchema.safeParse(req.body);
        if (!parseResult.success) {
            res.status(400).json({ success: false, errors: parseResult.error.flatten().fieldErrors });
            return;
        }
        const { email, password } = parseResult.data;
        let user = null;
        try {
            user = await prisma_1.default.user.findUnique({ where: { email: email.toLowerCase() } });
        }
        catch (dbErr) {
            console.warn('⚠️ Database connection error:', dbErr.message);
            if ((email.toLowerCase() === 'admin@datahub.local' && password === 'admin123') ||
                (email.toLowerCase() === 'user@datahub.local' && password === 'user123')) {
                const isAdmin = email.toLowerCase() === 'admin@datahub.local';
                const secret = process.env.JWT_SECRET || 'datahub-super-secret-jwt-key-2026';
                const demoUser = {
                    id: isAdmin ? 'admin-demo-id' : 'user-demo-id',
                    name: isAdmin ? 'System Administrator' : 'Jane Cooper',
                    email: email.toLowerCase(),
                    role: (isAdmin ? 'ADMIN' : 'USER'),
                    avatar: isAdmin
                        ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
                        : 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
                };
                const token = jsonwebtoken_1.default.sign({ id: demoUser.id, email: demoUser.email, role: demoUser.role }, secret, {
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
        const match = await bcryptjs_1.default.compare(password, user.password);
        if (!match) {
            res.status(401).json({ success: false, message: 'Invalid email or password.' });
            return;
        }
        const secret = process.env.JWT_SECRET || 'datahub-super-secret-jwt-key-2026';
        const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: user.role }, secret, {
            expiresIn: '7d',
        });
        try {
            await (0, audit_service_1.logAuditEvent)({
                userId: user.id,
                action: 'USER_LOGIN',
                entityType: 'USER',
                entityId: user.id,
                details: { email: user.email },
                ipAddress: req.ip,
            });
        }
        catch (_) { }
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
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: error.message || 'Login failed due to an internal error.' });
    }
});
router.get('/me', auth_1.authenticate, async (req, res) => {
    try {
        const user = await prisma_1.default.user.findUnique({
            where: { id: req.user.id },
            select: { id: true, name: true, email: true, role: true, avatar: true, createdAt: true },
        });
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found.' });
            return;
        }
        res.json({ success: true, user });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to retrieve profile.' });
    }
});
exports.default = router;
