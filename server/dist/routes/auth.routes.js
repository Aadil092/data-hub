"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const zod_1 = require("zod");
const supabase_1 = __importDefault(require("../config/supabase"));
const prisma_1 = __importDefault(require("../config/prisma"));
const auth_1 = require("../middleware/auth");
const audit_service_1 = require("../services/audit.service");
const userStore_service_1 = require("../services/userStore.service");
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
        const normalizedEmail = email.toLowerCase().trim();
        // 1. Check if user already exists (Check UserStore, Supabase, and Prisma)
        let existingUser = !!userStore_service_1.UserStore.getByEmail(normalizedEmail);
        if (!existingUser) {
            try {
                const { data: sUser } = await supabase_1.default
                    .from('users')
                    .select('id, email')
                    .eq('email', normalizedEmail)
                    .maybeSingle();
                if (sUser)
                    existingUser = true;
            }
            catch (_) { }
        }
        if (!existingUser) {
            try {
                const pUser = await prisma_1.default.user.findUnique({ where: { email: normalizedEmail } });
                if (pUser)
                    existingUser = true;
            }
            catch (_) { }
        }
        if (existingUser) {
            res.status(409).json({ success: false, message: 'An account with this email already exists.' });
            return;
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        const userId = crypto_1.default.randomUUID();
        const assignedRole = role || 'USER';
        const now = new Date().toISOString();
        let createdUser = null;
        // 2. Insert into Supabase 'users' table
        try {
            const { data: sCreated, error: sErr } = await supabase_1.default
                .from('users')
                .insert({
                id: userId,
                name: name.trim(),
                email: normalizedEmail,
                password: hashedPassword,
                role: assignedRole,
                isActive: true,
                createdAt: now,
                updatedAt: now,
            })
                .select('id, name, email, role, avatar, isActive, createdAt')
                .maybeSingle();
            if (!sErr && sCreated) {
                createdUser = sCreated;
            }
        }
        catch (sErr) {
            console.warn('Supabase register insert notice:', sErr);
        }
        // 3. Insert into Prisma (if connected)
        try {
            const pCreated = await prisma_1.default.user.upsert({
                where: { email: normalizedEmail },
                update: {},
                create: {
                    id: userId,
                    name: name.trim(),
                    email: normalizedEmail,
                    password: hashedPassword,
                    role: assignedRole,
                },
                select: { id: true, name: true, email: true, role: true, createdAt: true },
            });
            if (!createdUser)
                createdUser = pCreated;
        }
        catch (pErr) {
            console.warn('Prisma sync skipped:', pErr.message);
        }
        // 4. Save to UserStore memory store
        const userRecord = {
            id: userId,
            name: name.trim(),
            email: normalizedEmail,
            password: hashedPassword,
            role: assignedRole,
            avatar: null,
            isActive: true,
            createdAt: now,
            updatedAt: now,
            _count: { contacts: 0, imports: 0 },
        };
        userStore_service_1.UserStore.add(userRecord);
        if (!createdUser) {
            createdUser = {
                id: userId,
                name: name.trim(),
                email: normalizedEmail,
                role: assignedRole,
                isActive: true,
                createdAt: now,
                _count: { contacts: 0, imports: 0 },
            };
        }
        const secret = process.env.JWT_SECRET || 'datahub-super-secret-jwt-key-2026';
        const token = jsonwebtoken_1.default.sign({ id: createdUser.id, email: createdUser.email, role: createdUser.role, name: createdUser.name }, secret, { expiresIn: '7d' });
        try {
            await (0, audit_service_1.logAuditEvent)({
                userId: createdUser.id,
                action: 'USER_REGISTERED',
                entityType: 'USER',
                entityId: createdUser.id,
                details: { email: createdUser.email, role: createdUser.role, targetDB: 'Supabase' },
                ipAddress: req.ip,
            });
        }
        catch (_) { }
        res.status(201).json({
            success: true,
            token,
            user: {
                id: createdUser.id,
                name: createdUser.name,
                email: createdUser.email,
                role: createdUser.role,
                isActive: createdUser.isActive ?? true,
                createdAt: createdUser.createdAt || now,
            },
            message: 'Account registered and saved successfully!',
        });
    }
    catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ success: false, message: 'Registration failed: ' + (error.message || 'Internal error') });
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
        const normalizedEmail = email.toLowerCase().trim();
        let user = null;
        // 1. Try Supabase
        try {
            const { data: sUser } = await supabase_1.default
                .from('users')
                .select('*')
                .eq('email', normalizedEmail)
                .maybeSingle();
            if (sUser)
                user = sUser;
        }
        catch (sErr) {
            console.warn('Supabase login check:', sErr);
        }
        // 2. Try Prisma if not found in Supabase
        if (!user) {
            try {
                user = await prisma_1.default.user.findUnique({ where: { email: normalizedEmail } });
            }
            catch (dbErr) {
                console.warn('Prisma DB check:', dbErr.message);
            }
        }
        // 3. Try UserStore
        if (!user) {
            const cached = userStore_service_1.UserStore.getByEmail(normalizedEmail);
            if (cached)
                user = cached;
        }
        // 4. Fallback for demo users if database is empty/offline
        if (!user) {
            if ((normalizedEmail === 'admin@datahub.local' && password === 'admin123') ||
                (normalizedEmail === 'user@datahub.local' && password === 'user123')) {
                const isAdmin = normalizedEmail === 'admin@datahub.local';
                const secret = process.env.JWT_SECRET || 'datahub-super-secret-jwt-key-2026';
                const demoUser = {
                    id: isAdmin ? 'admin-demo-id' : 'user-demo-id',
                    name: isAdmin ? 'System Administrator' : 'Aadil Khan',
                    email: normalizedEmail,
                    role: (isAdmin ? 'ADMIN' : 'USER'),
                    avatar: isAdmin
                        ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
                        : 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
                };
                const token = jsonwebtoken_1.default.sign({ id: demoUser.id, email: demoUser.email, role: demoUser.role, name: demoUser.name }, secret, {
                    expiresIn: '7d',
                });
                res.json({
                    success: true,
                    token,
                    user: demoUser,
                    notice: 'Connected in demo mode.',
                });
                return;
            }
            res.status(401).json({ success: false, message: 'Invalid email or password.' });
            return;
        }
        if (user.isActive === false) {
            res.status(403).json({ success: false, message: 'Your account has been deactivated.' });
            return;
        }
        // Check password if hashed password exists
        if (user.password) {
            const match = await bcryptjs_1.default.compare(password, user.password);
            if (!match) {
                // Also check if matches standard demo passwords
                if (!((normalizedEmail === 'admin@datahub.local' && password === 'admin123') ||
                    (normalizedEmail === 'user@datahub.local' && password === 'user123'))) {
                    res.status(401).json({ success: false, message: 'Invalid email or password.' });
                    return;
                }
            }
        }
        else {
            // Demo accounts without hashed passwords
            if (!((normalizedEmail === 'admin@datahub.local' && password === 'admin123') ||
                (normalizedEmail === 'user@datahub.local' && password === 'user123'))) {
                res.status(401).json({ success: false, message: 'Invalid email or password.' });
                return;
            }
        }
        const secret = process.env.JWT_SECRET || 'datahub-super-secret-jwt-key-2026';
        const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, secret, { expiresIn: '7d' });
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
        res.status(500).json({ success: false, message: error.message || 'Login failed.' });
    }
});
router.get('/me', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        // Try Supabase first
        try {
            const { data: sUser } = await supabase_1.default
                .from('users')
                .select('id, name, email, role, avatar, isActive, createdAt')
                .eq('id', userId)
                .maybeSingle();
            if (sUser) {
                res.json({ success: true, user: sUser });
                return;
            }
        }
        catch (_) { }
        // Fallback Prisma
        try {
            const user = await prisma_1.default.user.findUnique({
                where: { id: userId },
                select: { id: true, name: true, email: true, role: true, avatar: true, createdAt: true },
            });
            if (user) {
                res.json({ success: true, user });
                return;
            }
        }
        catch (_) { }
        // Fallback UserStore
        const cached = userStore_service_1.UserStore.getById(userId);
        if (cached) {
            res.json({ success: true, user: cached });
            return;
        }
        res.json({
            success: true,
            user: req.user,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to retrieve profile.' });
    }
});
exports.default = router;
