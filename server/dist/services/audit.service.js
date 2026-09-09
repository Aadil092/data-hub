"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logAuditEvent = logAuditEvent;
const prisma_1 = __importDefault(require("../config/prisma"));
async function logAuditEvent(params) {
    try {
        await prisma_1.default.auditLog.create({
            data: {
                userId: params.userId || null,
                action: params.action,
                entityType: params.entityType,
                entityId: params.entityId || null,
                details: params.details || {},
                ipAddress: params.ipAddress || null,
            },
        });
    }
    catch (error) {
        console.error('Failed to write audit log:', error);
    }
}
