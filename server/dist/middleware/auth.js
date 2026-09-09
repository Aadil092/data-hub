"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
exports.requireAdmin = requireAdmin;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = __importDefault(require("../config/prisma"));
async function authenticate(req, res, next) {
    // Allow preflight OPTIONS requests to pass through
    if (req.method === 'OPTIONS') {
        next();
        return;
    }
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ success: false, message: 'Authentication required. No token provided.' });
            return;
        }
        const token = authHeader.split(' ')[1];
        const secret = process.env.JWT_SECRET || 'datahub-super-secret-jwt-key-2026';
        const decoded = jsonwebtoken_1.default.verify(token, secret);
        let user = null;
        try {
            user = await prisma_1.default.user.findUnique({
                where: { id: decoded.id },
                select: { id: true, email: true, name: true, role: true, isActive: true },
            });
        }
        catch (dbErr) {
            req.user = {
                id: decoded.id,
                email: decoded.email,
                name: decoded.role === 'ADMIN' ? 'System Administrator' : 'Jane Cooper',
                role: decoded.role,
            };
            next();
            return;
        }
        if (!user) {
            res.status(401).json({ success: false, message: 'User account not found.' });
            return;
        }
        if (!user.isActive) {
            res.status(403).json({ success: false, message: 'Account has been deactivated. Please contact an admin.' });
            return;
        }
        req.user = {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
        };
        next();
    }
    catch (error) {
        res.status(401).json({ success: false, message: 'Invalid or expired session token.' });
    }
}
function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'ADMIN') {
        res.status(403).json({ success: false, message: 'Admin privileges required for this action.' });
        return;
    }
    next();
}
