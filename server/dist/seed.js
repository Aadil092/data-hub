"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma_1 = __importDefault(require("./config/prisma"));
async function main() {
    console.log('🌱 Starting DATAHUB database seeding...');
    // Create or update Admin
    const adminPassword = await bcryptjs_1.default.hash('admin123', 10);
    const admin = await prisma_1.default.user.upsert({
        where: { email: 'admin@datahub.local' },
        update: {},
        create: {
            name: 'System Administrator',
            email: 'admin@datahub.local',
            password: adminPassword,
            role: 'ADMIN',
        },
    });
    // Create or update Standard User
    const userPassword = await bcryptjs_1.default.hash('user123', 10);
    const demoUser = await prisma_1.default.user.upsert({
        where: { email: 'user@datahub.local' },
        update: {},
        create: {
            name: 'User',
            email: 'user@datahub.local',
            password: userPassword,
            role: 'USER',
        },
    });
    console.log(`✅ Admin account: admin@datahub.local (password: admin123)`);
    console.log(`✅ Standard user account: user@datahub.local (password: user123)`);
    // Seed sample contacts for demo user
    const sampleContacts = [
        {
            firstName: 'Emily',
            lastName: 'Blunt',
            email: 'emily.blunt@apexglobal.com',
            phone: '+1 (555) 234-5678',
            company: 'Apex Global',
            jobTitle: 'VP of Product',
            tags: ['VIP', 'Enterprise', 'Tech'],
            status: 'CUSTOMER',
            notes: 'Key decision maker for upcoming enterprise renewal.',
        },
        {
            firstName: 'Michael',
            lastName: 'Chang',
            email: 'mchang@innovate.co',
            phone: '+1 (555) 345-6789',
            company: 'Innovate Labs',
            jobTitle: 'Chief Technology Officer',
            tags: ['SaaS', 'DecisionMaker'],
            status: 'PROSPECT',
            notes: 'Met at SaaStr 2026. Interested in automated Google Sheets integration.',
        },
        {
            firstName: 'Sophia',
            lastName: 'Rodriguez',
            email: 'sophia.r@nexushealth.org',
            phone: '+1 (555) 456-7890',
            company: 'Nexus Healthcare',
            jobTitle: 'Data Operations Director',
            tags: ['Healthcare', 'Compliance'],
            status: 'LEAD',
            notes: 'Needs HIPAA compliance guarantee for contact imports.',
        },
        {
            firstName: 'David',
            lastName: 'Kowalski',
            email: 'dkowalski@quantumfin.io',
            phone: '+1 (555) 567-8901',
            company: 'Quantum Finance',
            jobTitle: 'Security Architect',
            tags: ['Fintech', 'Audit'],
            status: 'CUSTOMER',
            notes: 'Requested automated audit log archiving.',
        },
        {
            firstName: 'Aaliyah',
            lastName: 'Patel',
            email: 'aaliyah@stratosmedia.com',
            phone: '+1 (555) 678-9012',
            company: 'Stratos Media Group',
            jobTitle: 'Marketing VP',
            tags: ['Media', 'Campaigns'],
            status: 'PROSPECT',
            notes: 'Wants bulk email blast integration.',
        },
        {
            firstName: 'Lucas',
            lastName: 'Vance',
            email: 'lucas.v@vanceindustries.com',
            phone: '+1 (555) 789-0123',
            company: 'Vance Industries',
            jobTitle: 'Procurement Manager',
            tags: ['Manufacturing'],
            status: 'ARCHIVED',
            notes: 'Contract expired Dec 2025.',
        },
        {
            firstName: 'Olivia',
            lastName: 'Bennett',
            email: 'olivia@luminarydesign.io',
            phone: '+1 (555) 890-1234',
            company: 'Luminary Design',
            jobTitle: 'Creative Director',
            tags: ['Design', 'Agency'],
            status: 'LEAD',
            notes: 'Referred by Michael Chang.',
        },
    ];
    for (const c of sampleContacts) {
        const existing = await prisma_1.default.contact.findFirst({
            where: { userId: demoUser.id, email: c.email },
        });
        if (!existing) {
            await prisma_1.default.contact.create({
                data: {
                    userId: demoUser.id,
                    ...c,
                    source: 'MANUAL',
                },
            });
        }
    }
    // Also seed an initial import batch record
    const existingBatch = await prisma_1.default.importBatch.findFirst({ where: { userId: demoUser.id } });
    if (!existingBatch) {
        await prisma_1.default.importBatch.create({
            data: {
                userId: demoUser.id,
                fileName: 'Q1_Leads_Database.xlsx',
                fileType: 'XLSX',
                totalRows: 120,
                importedRows: 114,
                duplicateRows: 4,
                failedRows: 2,
                status: 'PARTIAL',
                errorLog: [
                    { row: 42, error: 'Invalid email syntax: "john.doe@@invalid"', data: { name: 'John Doe' } },
                    { row: 88, error: 'First name is required', data: { email: 'unknown@web.com' } },
                ],
            },
        });
    }
    console.log(` Sample contacts and initial import batch created.`);
    console.log(' Seeding completed successfully!');
}
main()
    .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma_1.default.$disconnect();
});
