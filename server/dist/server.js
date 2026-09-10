"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const user_routes_1 = __importDefault(require("./routes/user.routes"));
const contact_routes_1 = __importDefault(require("./routes/contact.routes"));
const import_routes_1 = __importDefault(require("./routes/import.routes"));
const export_routes_1 = __importDefault(require("./routes/export.routes"));
const history_routes_1 = __importDefault(require("./routes/history.routes"));
const googleSync_routes_1 = __importDefault(require("./routes/googleSync.routes"));
const admin_routes_1 = __importDefault(require("./routes/admin.routes"));
const emailCampaign_routes_1 = __importDefault(require("./routes/emailCampaign.routes"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5001;
// Middleware
const corsOptions = {
    origin: (origin, callback) => {
        // Permissive in dev for localhost, 127.0.0.1, or configured CLIENT_URL
        callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
};
app.use((0, cors_1.default)(corsOptions));
app.options('*', (0, cors_1.default)(corsOptions));
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '50mb' }));
// Health Check Endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'online',
        timestamp: new Date().toISOString(),
        service: 'DATAHUB Core API',
    });
});
// Mount Routes
app.use('/api/auth', auth_routes_1.default);
app.use('/api/users', user_routes_1.default);
app.use('/api/contacts', contact_routes_1.default);
app.use('/api/import', import_routes_1.default);
app.use('/api/export', export_routes_1.default);
app.use('/api/history', history_routes_1.default);
app.use('/api/google-sync', googleSync_routes_1.default);
app.use('/api/admin', admin_routes_1.default);
app.use('/api/email', emailCampaign_routes_1.default);
// Global 404 Handler
app.use((req, res) => {
    res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.url}` });
});
// Global Error Handler
app.use((err, req, res, next) => {
    console.error('Unhandled Server Error:', err);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal Server Error',
    });
});
app.listen(PORT, () => {
    console.log(` Server running on port ${PORT}`);
    console.log(` http://localhost:${PORT}/api/health`);
    console.log(` Supabase User Router: http://localhost:${PORT}/api/users`);
});
exports.default = app;
