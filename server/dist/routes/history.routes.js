"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../config/prisma"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
// GET /api/history - List import batches for user
router.get('/', async (req, res) => {
    try {
        const userId = req.user.id;
        const batches = await prisma_1.default.importBatch.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
        res.json({ success: true, batches });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch import history.' });
    }
});
// GET /api/history/:id - Single batch details
router.get('/:id', async (req, res) => {
    try {
        const batchId = req.params.id;
        const batch = await prisma_1.default.importBatch.findFirst({
            where: { id: batchId, userId: req.user.id },
        });
        if (!batch) {
            res.status(404).json({ success: false, message: 'Import batch not found.' });
            return;
        }
        res.json({ success: true, batch });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch batch details.' });
    }
});
exports.default = router;
