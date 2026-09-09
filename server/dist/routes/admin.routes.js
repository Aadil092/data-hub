"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const zod_1 = require("zod");
const prisma_1 = __importDefault(require("../config/prisma"));
const auth_1 = require("../middleware/auth");
const audit_service_1 = require("../services/audit.service");
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
// GET /api/admin/users - List all users with contact counts
router.get('/users', async (req, res) => {
    try {
        const users = await prisma_1.default.user.findMany({
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
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch users.' });
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
        const existing = await prisma_1.default.user.findUnique({ where: { email: normalizedEmail } });
        if (existing) {
            res.status(409).json({ success: false, message: 'An account with this email already exists.' });
            return;
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        const newUser = await prisma_1.default.user.create({
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
        await (0, audit_service_1.logAuditEvent)({
            userId: req.user.id,
            action: 'USER_CREATED',
            entityType: 'USER',
            entityId: newUser.id,
            details: { name: newUser.name, email: newUser.email, role: newUser.role, isActive: newUser.isActive },
            ipAddress: req.ip,
        });
        res.status(201).json({ success: true, user: newUser, message: 'User created successfully.' });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to create user.' });
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
        const existingUser = await prisma_1.default.user.findUnique({ where: { id: userId } });
        if (!existingUser) {
            res.status(404).json({ success: false, message: 'User not found.' });
            return;
        }
        const { name, email, password, role, isActive } = parseResult.data;
        const updateData = {};
        if (name !== undefined)
            updateData.name = name.trim();
        if (role !== undefined)
            updateData.role = role;
        if (isActive !== undefined)
            updateData.isActive = isActive;
        if (email !== undefined) {
            const normalizedEmail = email.toLowerCase().trim();
            if (normalizedEmail !== existingUser.email) {
                const emailTaken = await prisma_1.default.user.findUnique({ where: { email: normalizedEmail } });
                if (emailTaken) {
                    res.status(409).json({ success: false, message: 'This email is already in use by another account.' });
                    return;
                }
                updateData.email = normalizedEmail;
            }
        }
        if (password && password.trim().length >= 6) {
            updateData.password = await bcryptjs_1.default.hash(password.trim(), 10);
        }
        const updatedUser = await prisma_1.default.user.update({
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
        res.status(500).json({ success: false, message: 'Failed to update user.' });
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
        const targetUser = await prisma_1.default.user.findUnique({
            where: { id: userId },
            select: { id: true, name: true, email: true, role: true },
        });
        if (!targetUser) {
            res.status(404).json({ success: false, message: 'User not found.' });
            return;
        }
        await prisma_1.default.user.delete({ where: { id: userId } });
        await (0, audit_service_1.logAuditEvent)({
            userId: req.user.id,
            action: 'USER_DELETED',
            entityType: 'USER',
            entityId: targetUser.id,
            details: { deletedEmail: targetUser.email, deletedName: targetUser.name, role: targetUser.role },
            ipAddress: req.ip,
        });
        res.json({ success: true, message: `User "${targetUser.name}" has been permanently deleted.` });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete user.' });
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
        const targetUser = await prisma_1.default.user.update({
            where: { id: userId },
            data: { role },
            select: { id: true, name: true, email: true, role: true },
        });
        await (0, audit_service_1.logAuditEvent)({
            userId: req.user.id,
            action: 'USER_ROLE_CHANGED',
            entityType: 'USER',
            entityId: targetUser.id,
            details: { newRole: role, targetEmail: targetUser.email },
            ipAddress: req.ip,
        });
        res.json({ success: true, user: targetUser });
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
        const targetUser = await prisma_1.default.user.update({
            where: { id: userId },
            data: { isActive },
            select: { id: true, name: true, email: true, isActive: true },
        });
        await (0, audit_service_1.logAuditEvent)({
            userId: req.user.id,
            action: isActive ? 'USER_ACTIVATED' : 'USER_SUSPENDED',
            entityType: 'USER',
            entityId: targetUser.id,
            details: { isActive, targetEmail: targetUser.email },
            ipAddress: req.ip,
        });
        res.json({ success: true, user: targetUser });
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
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch audit logs.' });
    }
});
// GET /api/admin/stats - System-wide metrics
router.get('/stats', async (req, res) => {
    try {
        const [totalUsers, totalContacts, totalImports, totalAuditLogs, statusBreakdown, sourceBreakdown] = await Promise.all([
            prisma_1.default.user.count(),
            prisma_1.default.contact.count(),
            prisma_1.default.importBatch.count(),
            prisma_1.default.auditLog.count(),
            prisma_1.default.contact.groupBy({
                by: ['status'],
                _count: { id: true },
            }),
            prisma_1.default.contact.groupBy({
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
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch system stats.' });
    }
});
exports.default = router;
