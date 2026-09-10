"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
const zod_1 = require("zod");
const supabase_1 = __importDefault(require("../config/supabase"));
const prisma_1 = __importDefault(require("../config/prisma"));
const audit_service_1 = require("../services/audit.service");
const userStore_service_1 = require("../services/userStore.service");
const router = (0, express_1.Router)();
// Validation Schemas
const createUserSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, 'Name must be at least 2 characters'),
    email: zod_1.z.string().email('Invalid email address'),
    password: zod_1.z.string().min(6, 'Password must be at least 6 characters'),
    role: zod_1.z.enum(['USER', 'ADMIN']).default('USER'),
    avatar: zod_1.z.string().optional(),
    isActive: zod_1.z.boolean().default(true),
});
const updateUserSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).optional(),
    email: zod_1.z.string().email().optional(),
    password: zod_1.z.string().min(6).optional(),
    role: zod_1.z.enum(['USER', 'ADMIN']).optional(),
    avatar: zod_1.z.string().optional(),
    isActive: zod_1.z.boolean().optional(),
});
/**
 * Helper to ensure a user is also synced with local Prisma if reachable
 */
async function syncPrismaSafe(action) {
    try {
        await action();
    }
    catch (err) {
        console.warn('Prisma sync skipped/error:', err.message);
    }
}
/**
 * GET /api/users/test-connection
 * Check Supabase connection and table readiness
 */
router.get('/test-connection', async (_req, res) => {
    try {
        const { data, error } = await supabase_1.default.from('users').select('id, email, name, role').limit(1);
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
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to connect to Supabase.',
            error: error.message,
        });
    }
});
/**
 * GET /api/users
 * Retrieve all users (Merged from Supabase, Prisma, and UserStore)
 */
router.get('/', async (req, res) => {
    try {
        const { search, role, page = '1', limit = '50' } = req.query;
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const take = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
        const offset = (pageNum - 1) * take;
        const userMap = new Map();
        // 1. Seed with in-memory UserStore
        const cachedUsers = userStore_service_1.UserStore.getAll();
        cachedUsers.forEach((u) => {
            userMap.set(u.email.toLowerCase(), { ...u });
        });
        // 2. Fetch from Supabase
        try {
            const { data: sUsers } = await supabase_1.default
                .from('users')
                .select('id, name, email, role, avatar, isActive, createdAt, updatedAt');
            if (Array.isArray(sUsers)) {
                sUsers.forEach((u) => {
                    const email = u.email.toLowerCase();
                    const existing = userMap.get(email);
                    userMap.set(email, { ...existing, ...u });
                });
            }
        }
        catch (_) { }
        // 3. Fetch from Prisma
        try {
            const pUsers = await prisma_1.default.user.findMany({
                select: { id: true, name: true, email: true, role: true, avatar: true, isActive: true, createdAt: true, updatedAt: true },
            });
            if (Array.isArray(pUsers)) {
                pUsers.forEach((u) => {
                    const email = u.email.toLowerCase();
                    const existing = userMap.get(email);
                    userMap.set(email, { ...existing, ...u });
                });
            }
        }
        catch (_) { }
        let allUsers = Array.from(userMap.values());
        if (role && (role === 'USER' || role === 'ADMIN')) {
            allUsers = allUsers.filter((u) => u.role === role);
        }
        if (search && typeof search === 'string') {
            const s = search.toLowerCase().trim();
            allUsers = allUsers.filter((u) => (u.name && u.name.toLowerCase().includes(s)) || (u.email && u.email.toLowerCase().includes(s)));
        }
        allUsers.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        const total = allUsers.length;
        const paginated = allUsers.slice(offset, offset + take);
        res.json({
            success: true,
            users: paginated,
            pagination: {
                page: pageNum,
                limit: take,
                total,
                totalPages: Math.ceil(total / take) || 1,
            },
            source: 'unified',
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Server error retrieving users.', error: error.message });
    }
});
/**
 * GET /api/users/:id
 * Retrieve a specific user by ID from Supabase
 */
router.get('/:id', async (req, res) => {
    try {
        const id = String(req.params.id);
        const { data: user, error } = await supabase_1.default
            .from('users')
            .select('id, name, email, role, avatar, isActive, createdAt, updatedAt')
            .eq('id', id)
            .maybeSingle();
        if (error) {
            // Fallback to Prisma
            try {
                const pUser = await prisma_1.default.user.findUnique({
                    where: { id },
                    select: { id: true, name: true, email: true, role: true, avatar: true, isActive: true, createdAt: true, updatedAt: true },
                });
                if (!pUser) {
                    res.status(404).json({ success: false, message: 'User not found.' });
                    return;
                }
                res.json({ success: true, user: pUser, source: 'prisma' });
                return;
            }
            catch {
                res.status(500).json({ success: false, message: 'Failed to fetch user.', error });
                return;
            }
        }
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found in Supabase.' });
            return;
        }
        res.json({ success: true, user, source: 'supabase' });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Server error.', error: error.message });
    }
});
/**
 * POST /api/users (or /api/users/create)
 * Create a new user directly in Supabase DB
 */
router.post(['/', '/create'], async (req, res) => {
    try {
        const parseResult = createUserSchema.safeParse(req.body);
        if (!parseResult.success) {
            res.status(400).json({ success: false, errors: parseResult.error.flatten().fieldErrors });
            return;
        }
        const { name, email, password, role, avatar, isActive } = parseResult.data;
        const normalizedEmail = email.toLowerCase().trim();
        // 1. Check if user already exists in Supabase
        const { data: existingUser } = await supabase_1.default
            .from('users')
            .select('id, email')
            .eq('email', normalizedEmail)
            .maybeSingle();
        if (existingUser) {
            res.status(409).json({ success: false, message: 'An account with this email already exists in Supabase.' });
            return;
        }
        // 2. Hash password & prepare payload
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        const userId = crypto_1.default.randomUUID();
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
        const { data: insertedUser, error: insertError } = await supabase_1.default
            .from('users')
            .insert(newUserData)
            .select('id, name, email, role, avatar, isActive, createdAt, updatedAt')
            .single();
        if (insertError) {
            console.error('Supabase user insert error:', insertError);
            try {
                const pUser = await prisma_1.default.user.create({
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
            }
            catch (prismaErr) {
                res.status(500).json({
                    success: false,
                    message: 'Failed to create user in Supabase.',
                    error: insertError.message || insertError,
                });
                return;
            }
        }
        // 4. Safe sync to Prisma (optional background)
        syncPrismaSafe(() => prisma_1.default.user.upsert({
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
        }));
        // 5. Audit log
        try {
            await (0, audit_service_1.logAuditEvent)({
                userId,
                action: 'USER_CREATE',
                entityType: 'USER',
                entityId: userId,
                details: { email: normalizedEmail, role, createdVia: 'Supabase DB' },
                ipAddress: req.ip,
            });
        }
        catch (_) { }
        res.status(201).json({
            success: true,
            message: 'User created successfully in Supabase DB!',
            user: insertedUser,
        });
    }
    catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ success: false, message: 'Server error while creating user.', error: error.message });
    }
});
/**
 * PUT /api/users/:id or PATCH /api/users/:id
 * Update user in Supabase DB
 */
router.all(['/:id', '/update/:id'], async (req, res) => {
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
        const updateData = {
            updatedAt: new Date().toISOString(),
        };
        if (parseResult.data.name !== undefined)
            updateData.name = parseResult.data.name.trim();
        if (parseResult.data.email !== undefined)
            updateData.email = parseResult.data.email.toLowerCase().trim();
        if (parseResult.data.role !== undefined)
            updateData.role = parseResult.data.role;
        if (parseResult.data.avatar !== undefined)
            updateData.avatar = parseResult.data.avatar;
        if (parseResult.data.isActive !== undefined)
            updateData.isActive = parseResult.data.isActive;
        if (parseResult.data.password) {
            updateData.password = await bcryptjs_1.default.hash(parseResult.data.password, 10);
        }
        // 1. Update in Supabase
        const { data: updatedUser, error: updateError } = await supabase_1.default
            .from('users')
            .update(updateData)
            .eq('id', id)
            .select('id, name, email, role, avatar, isActive, createdAt, updatedAt')
            .maybeSingle();
        if (updateError || !updatedUser) {
            // Fallback to Prisma
            try {
                const pUpdated = await prisma_1.default.user.update({
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
            }
            catch (prismaErr) {
                res.status(500).json({
                    success: false,
                    message: 'Failed to update user in Supabase.',
                    error: updateError,
                });
                return;
            }
        }
        // 2. Safe sync to Prisma
        syncPrismaSafe(() => prisma_1.default.user.update({
            where: { id },
            data: updateData,
        }));
        res.json({
            success: true,
            message: 'User updated successfully in Supabase DB!',
            user: updatedUser,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Server error while updating user.', error: error.message });
    }
});
/**
 * DELETE /api/users/:id
 * Delete a user from Supabase DB
 */
router.delete('/:id', async (req, res) => {
    try {
        const id = String(req.params.id);
        // 1. Delete in Supabase
        const { error: deleteError } = await supabase_1.default
            .from('users')
            .delete()
            .eq('id', id);
        if (deleteError) {
            // Fallback to Prisma
            try {
                await prisma_1.default.user.delete({ where: { id } });
                res.json({ success: true, message: 'User deleted successfully (Prisma).' });
                return;
            }
            catch (prismaErr) {
                res.status(500).json({
                    success: false,
                    message: 'Failed to delete user from Supabase.',
                    error: deleteError,
                });
                return;
            }
        }
        // 2. Safe sync delete to Prisma
        syncPrismaSafe(() => prisma_1.default.user.delete({ where: { id } }));
        res.json({
            success: true,
            message: 'User deleted successfully from Supabase DB!',
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Server error while deleting user.', error: error.message });
    }
});
exports.default = router;
