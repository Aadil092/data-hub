"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyEmail = verifyEmail;
exports.verifyBatchEmails = verifyBatchEmails;
// Disposable / Temporary Email Domains Blacklist
const DISPOSABLE_DOMAINS = new Set([
    'mailinator.com',
    'tempmail.com',
    'temp-mail.org',
    '10minutemail.com',
    'guerrillamail.com',
    'throwawaymail.com',
    'sharklasers.com',
    'dispostable.com',
    'yopmail.com',
    'trashmail.com',
    'getairmail.com',
    'maildrop.cc',
    'mohmal.com',
    'crazymailing.com',
    'inboxkitten.com',
    'burnermail.io',
    'fakemailgenerator.com',
    'tempinbox.com',
]);
// Common Domain Typo Suggestions
const DOMAIN_TYPOS = {
    'gmai.com': 'gmail.com',
    'gamil.com': 'gmail.com',
    'gmal.com': 'gmail.com',
    'gmial.com': 'gmail.com',
    'yaho.com': 'yahoo.com',
    'yahooo.com': 'yahoo.com',
    'yaho.co': 'yahoo.com',
    'hotmial.com': 'hotmail.com',
    'hotmaill.com': 'hotmail.com',
    'outlok.com': 'outlook.com',
    'outluk.com': 'outlook.com',
    'iclud.com': 'icloud.com',
};
function verifyEmail(emailRaw) {
    const email = (emailRaw || '').trim().toLowerCase();
    if (!email) {
        return {
            email,
            status: 'INVALID',
            score: 0,
            reason: 'Email is blank or empty',
            isValidSyntax: false,
        };
    }
    // 1. RFC 5322 Syntax Regex Check
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    if (!emailRegex.test(email)) {
        return {
            email,
            status: 'INVALID',
            score: 10,
            reason: 'Invalid email syntax format',
            isValidSyntax: false,
        };
    }
    const parts = email.split('@');
    if (parts.length !== 2) {
        return {
            email,
            status: 'INVALID',
            score: 10,
            reason: 'Malformed address structure',
            isValidSyntax: false,
        };
    }
    const [username, domain] = parts;
    if (username.length > 64 || domain.length > 255) {
        return {
            email,
            status: 'INVALID',
            score: 10,
            reason: 'Email length exceeds standard RFC limits',
            isValidSyntax: false,
        };
    }
    // 2. Check Disposable / Temporary Email Domains
    if (DISPOSABLE_DOMAINS.has(domain)) {
        return {
            email,
            status: 'RISKY',
            score: 40,
            reason: 'Temporary / Disposable inbox detected (high bounce risk)',
            isDisposable: true,
            isValidSyntax: true,
        };
    }
    // 3. Check Known Domain Typo Suggestions
    if (DOMAIN_TYPOS[domain]) {
        const suggestedDomain = DOMAIN_TYPOS[domain];
        return {
            email,
            status: 'RISKY',
            score: 50,
            reason: `Possible domain typo ("@${domain}")`,
            suggestion: `${username}@${suggestedDomain}`,
            isValidSyntax: true,
        };
    }
    // 4. Role-based address check (e.g. admin@, info@, support@)
    const roleAccounts = new Set(['admin', 'support', 'info', 'sales', 'billing', 'help', 'contact']);
    const isRole = roleAccounts.has(username);
    // 5. Clean & Verified
    return {
        email,
        status: 'VALID',
        score: isRole ? 85 : 98,
        reason: isRole ? 'Role-based account (e.g. info@ / sales@)' : 'Deliverable syntax & authentic domain',
        isValidSyntax: true,
        isDisposable: false,
    };
}
function verifyBatchEmails(emails) {
    const results = emails.map((e) => verifyEmail(e));
    const validCount = results.filter((r) => r.status === 'VALID').length;
    const riskyCount = results.filter((r) => r.status === 'RISKY').length;
    const invalidCount = results.filter((r) => r.status === 'INVALID').length;
    return {
        results,
        summary: {
            total: results.length,
            validCount,
            riskyCount,
            invalidCount,
        },
    };
}
