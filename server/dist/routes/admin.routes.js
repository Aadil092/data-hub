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
const auth_1 = require("../middleware/auth");
const audit_service_1 = require("../services/audit.service");
const userStore_service_1 = require("../services/userStore.service");
const router = (0, express_1.Router)();
// Apply auth and requireAdmin to all admin routes
router.use(auth_1.authenticate);
router.use(auth_1.requireAdmin);
const createUserSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, 'Name must be at least 2 characters'),
    email: zod_1.z.string().email('Invalid email address'),
    password: zod_1.z.string().min(6, 'Password must be at least 6 characters'),
    role: zod_1.z.enum(['USER', 'ADMIN']).optional().default('USER'),
    isActive: zod_1.z.boolean().optional().default(true),
});
const updateUserSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, 'Name must be at least 2 characters').optional(),
    email: zod_1.z.string().email('Invalid email address').optional(),
    password: zod_1.z.string().min(6, 'Password must be at least 6 characters').optional(),
    role: zod_1.z.enum(['USER', 'ADMIN']).optional(),
    isActive: zod_1.z.boolean().optional(),
});
// Helper for safe Prisma background sync
async function syncPrismaSafe(action) {
    try {
        await action();
    }
    catch (err) {
        console.warn('Prisma sync skipped/error:', err.message);
    }
}
// GET /api/admin/users - List all users (Merged from Supabase, Prisma, and UserStore)
router.get('/users', async (req, res) => {
    try {
        const userMap = new Map();
        // 1. Seed with in-memory UserStore (includes all registered users)
        const cachedUsers = userStore_service_1.UserStore.getAll();
        cachedUsers.forEach((u) => {
            userMap.set(u.email.toLowerCase(), {
                ...u,
                _count: u._count || { contacts: 0, imports: 0 },
            });
        });
        // 2. Fetch from Supabase
        try {
            const { data: sUsers, error: sErr } = await supabase_1.default
                .from('users')
                .select('id, name, email, role, avatar, isActive, createdAt, updatedAt')
                .order('createdAt', { ascending: false });
            if (!sErr && Array.isArray(sUsers)) {
                sUsers.forEach((u) => {
                    const email = u.email.toLowerCase();
                    const existing = userMap.get(email);
                    userMap.set(email, {
                        ...existing,
                        ...u,
                        _count: existing?._count || { contacts: 0, imports: 0 },
                    });
                });
            }
        }
        catch (sErr) {
            console.warn('Supabase fetch in admin.users:', sErr);
        }
        // 3. Fetch from Prisma
        try {
            const pUsers = await prisma_1.default.user.findMany({
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    isActive: true,
                    createdAt: true,
                    updatedAt: true,
                    _count: {
                        select: {
                            contacts: true,
                            imports: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
            });
            if (Array.isArray(pUsers)) {
                pUsers.forEach((u) => {
                    const email = u.email.toLowerCase();
                    const existing = userMap.get(email);
                    userMap.set(email, {
                        ...existing,
                        ...u,
                        _count: u._count || existing?._count || { contacts: 0, imports: 0 },
                    });
                });
            }
        }
        catch (pErr) {
            console.warn('Prisma fetch in admin.users skipped:', pErr.message);
        }
        // Convert map to array sorted by creation date descending
        const allUsers = Array.from(userMap.values()).sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        res.json({ success: true, users: allUsers, count: allUsers.length });
    }
    catch (error) {
        console.error('Error fetching admin users:', error);
        // Fallback to UserStore so response is never blank or 500
        const fallbackUsers = userStore_service_1.UserStore.getAll();
        res.json({ success: true, users: fallbackUsers, count: fallbackUsers.length });
    }
});
// POST /api/admin/users - Admin creates a new user
router.post('/users', async (req, res) => {
    try {
        const parseResult = createUserSchema.safeParse(req.body);
        if (!parseResult.success) {
            res.status(400).json({ success: false, errors: parseResult.error.flatten().fieldErrors });
            return;
        }
        const { name, email, password, role, isActive } = parseResult.data;
        const normalizedEmail = email.toLowerCase().trim();
        // 1. Check existing in UserStore, Supabase, or Prisma
        let existing = !!userStore_service_1.UserStore.getByEmail(normalizedEmail);
        if (!existing) {
            try {
                const { data: sUser } = await supabase_1.default.from('users').select('id').eq('email', normalizedEmail).maybeSingle();
                if (sUser)
                    existing = true;
            }
            catch (_) { }
        }
        if (!existing) {
            try {
                const pUser = await prisma_1.default.user.findUnique({ where: { email: normalizedEmail } });
                if (pUser)
                    existing = true;
            }
            catch (_) { }
        }
        if (existing) {
            res.status(409).json({ success: false, message: 'An account with this email already exists.' });
            return;
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        const userId = crypto_1.default.randomUUID();
        const now = new Date().toISOString();
        let createdUser = null;
        // 2. Insert into Supabase
        try {
            const { data: sCreated, error: sErr } = await supabase_1.default
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
        }
        catch (sErr) {
            console.warn('Supabase admin create notice:', sErr);
        }
        // 3. Insert into Prisma (if reachable)
        try {
            const pCreated = await prisma_1.default.user.create({
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
            if (!createdUser)
                createdUser = pCreated;
        }
        catch (pErr) {
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
        // 4. Save to UserStore
        userStore_service_1.UserStore.add({
            id: userId,
            name: name.trim(),
            email: normalizedEmail,
            password: hashedPassword,
            role: role,
            avatar: null,
            isActive: isActive ?? true,
            createdAt: now,
            updatedAt: now,
            _count: { contacts: 0, imports: 0 },
        });
        await (0, audit_service_1.logAuditEvent)({
            userId: req.user.id,
            action: 'USER_CREATED',
            entityType: 'USER',
            entityId: createdUser.id,
            details: { name: createdUser.name, email: createdUser.email, role: createdUser.role, isActive: createdUser.isActive },
            ipAddress: req.ip,
        });
        res.status(201).json({ success: true, user: createdUser, message: 'User created successfully.' });
    }
    catch (error) {
        console.error('Error creating admin user:', error);
        res.status(500).json({ success: false, message: error?.message || 'Failed to create user.' });
    }
});
// PUT /api/admin/users/:id - Admin updates user profile / credentials
router.put('/users/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        const parseResult = updateUserSchema.safeParse(req.body);
        if (!parseResult.success) {
            res.status(400).json({ success: false, errors: parseResult.error.flatten().fieldErrors });
            return;
        }
        const { name, email, password, role, isActive } = parseResult.data;
        const updateData = { updatedAt: new Date().toISOString() };
        if (name !== undefined)
            updateData.name = name.trim();
        if (role !== undefined)
            updateData.role = role;
        if (isActive !== undefined)
            updateData.isActive = isActive;
        if (email !== undefined) {
            updateData.email = email.toLowerCase().trim();
        }
        if (password && password.trim().length >= 6) {
            updateData.password = await bcryptjs_1.default.hash(password.trim(), 10);
        }
        let updatedUser = null;
        // 1. Update in Supabase
        try {
            const { data: sUpdated, error: sErr } = await supabase_1.default
                .from('users')
                .update(updateData)
                .eq('id', userId)
                .select('id, name, email, role, avatar, isActive, createdAt')
                .maybeSingle();
            if (!sErr && sUpdated) {
                updatedUser = { ...sUpdated, _count: { contacts: 0, imports: 0 } };
            }
        }
        catch (sErr) {
            console.warn('Supabase admin update notice:', sErr);
        }
        // 2. Sync to Prisma
        try {
            const pUpdated = await prisma_1.default.user.update({
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
            if (!updatedUser)
                updatedUser = pUpdated;
        }
        catch (pErr) {
            console.warn('Prisma admin update skipped:', pErr.message);
        }
        // 3. Update in UserStore
        const cachedUpdate = userStore_service_1.UserStore.update(userId, updateData);
        if (!updatedUser && cachedUpdate) {
            updatedUser = cachedUpdate;
        }
        if (!updatedUser) {
            res.status(404).json({ success: false, message: 'User not found or update failed.' });
            return;
        }
        await (0, audit_service_1.logAuditEvent)({
            userId: req.user.id,
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
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update user.', error: error.message });
    }
});
// DELETE /api/admin/users/:id - Admin deletes a user
router.delete('/users/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        // Prevent administrator from deleting their own account
        if (userId === req.user.id) {
            res.status(400).json({ success: false, message: 'You cannot delete your own administrator account.' });
            return;
        }
        // 1. Delete in Supabase
        try {
            await supabase_1.default.from('users').delete().eq('id', userId);
        }
        catch (sErr) {
            console.warn('Supabase delete user notice:', sErr);
        }
        // 2. Delete in Prisma
        syncPrismaSafe(() => prisma_1.default.user.delete({ where: { id: userId } }));
        // 3. Delete in UserStore
        userStore_service_1.UserStore.delete(userId);
        await (0, audit_service_1.logAuditEvent)({
            userId: req.user.id,
            action: 'USER_DELETED',
            entityType: 'USER',
            entityId: userId,
            details: { deletedUserId: userId },
            ipAddress: req.ip,
        });
        res.json({ success: true, message: 'User has been deleted successfully.' });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete user.', error: error.message });
    }
});
// PUT /api/admin/users/:id/role - Update user role
router.put('/users/:id/role', async (req, res) => {
    try {
        const { role } = req.body;
        if (!['USER', 'ADMIN'].includes(role)) {
            res.status(400).json({ success: false, message: 'Invalid role. Must be USER or ADMIN.' });
            return;
        }
        const userId = req.params.id;
        // Supabase update
        try {
            await supabase_1.default.from('users').update({ role, updatedAt: new Date().toISOString() }).eq('id', userId);
        }
        catch (_) { }
        // Prisma update
        syncPrismaSafe(() => prisma_1.default.user.update({ where: { id: userId }, data: { role } }));
        // UserStore update
        userStore_service_1.UserStore.update(userId, { role });
        await (0, audit_service_1.logAuditEvent)({
            userId: req.user.id,
            action: 'USER_ROLE_CHANGED',
            entityType: 'USER',
            entityId: userId,
            details: { newRole: role },
            ipAddress: req.ip,
        });
        res.json({ success: true, message: 'User role updated successfully.' });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update user role.' });
    }
});
// PUT /api/admin/users/:id/status - Toggle active/suspended
router.put('/users/:id/status', async (req, res) => {
    try {
        const { isActive } = req.body;
        if (typeof isActive !== 'boolean') {
            res.status(400).json({ success: false, message: 'isActive must be a boolean.' });
            return;
        }
        const userId = req.params.id;
        // Supabase update
        try {
            await supabase_1.default.from('users').update({ isActive, updatedAt: new Date().toISOString() }).eq('id', userId);
        }
        catch (_) { }
        // Prisma update
        syncPrismaSafe(() => prisma_1.default.user.update({ where: { id: userId }, data: { isActive } }));
        // UserStore update
        userStore_service_1.UserStore.update(userId, { isActive });
        await (0, audit_service_1.logAuditEvent)({
            userId: req.user.id,
            action: isActive ? 'USER_ACTIVATED' : 'USER_SUSPENDED',
            entityType: 'USER',
            entityId: userId,
            details: { isActive },
            ipAddress: req.ip,
        });
        res.json({ success: true, message: `User status set to ${isActive ? 'Active' : 'Suspended'}.` });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update user status.' });
    }
});
// GET /api/admin/audit-logs - Query audit trail
router.get('/audit-logs', async (req, res) => {
    try {
        const { limit = '50', action, entityType } = req.query;
        const take = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
        // Try Prisma for audit logs with fallback
        try {
            const where = {};
            if (action && typeof action === 'string')
                where.action = action;
            if (entityType && typeof entityType === 'string')
                where.entityType = entityType;
            const logs = await prisma_1.default.auditLog.findMany({
                where,
                include: {
                    user: { select: { name: true, email: true, role: true } },
                },
                orderBy: { createdAt: 'desc' },
                take,
            });
            res.json({ success: true, logs });
            return;
        }
        catch {
            // Fallback empty list if DB offline
            res.json({ success: true, logs: [] });
        }
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch audit logs.' });
    }
});
// GET /api/admin/stats - System-wide metrics
router.get('/stats', async (req, res) => {
    try {
        let totalUsers = userStore_service_1.UserStore.getAll().length;
        try {
            const { count } = await supabase_1.default.from('users').select('*', { count: 'exact', head: true });
            if (count && count > totalUsers)
                totalUsers = count;
        }
        catch (_) { }
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
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch system stats.' });
    }
});
exports.default = router;
