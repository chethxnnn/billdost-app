// DEPRECATED (Stage 2): replaced by the official WhatsApp Cloud API in
// billdost/src/server/whatsapp.ts. Do not deploy. See README.md here.
const express = require('express');
const cors = require('cors');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

process.on('uncaughtException', (err) => {
    console.error('[Process] Uncaught Exception:', err.message);
});
process.on('unhandledRejection', (reason) => {
    console.error('[Process] Unhandled Rejection:', reason);
});

// In-memory store for clients
// Map of shopId -> { client, qrCode, status: 'INITIALIZING' | 'QR_READY' | 'AUTHENTICATED' | 'READY' | 'DISCONNECTED' }
const clients = {};

// Helper to initialize a WhatsApp client for a specific shop
function initClient(shopId) {
    if (clients[shopId] && clients[shopId].status !== 'DISCONNECTED') {
        return clients[shopId];
    }

    console.log(`[Shop ${shopId}] Initializing WhatsApp Client...`);

    const client = new Client({
        authStrategy: new LocalAuth({ clientId: shopId }),
        puppeteer: {
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
        }
    });

    clients[shopId] = {
        client,
        qrCode: null,
        status: 'INITIALIZING'
    };

    client.on('qr', async (qr) => {
        console.log(`[Shop ${shopId}] QR Code Received!`);
        try {
            const qrDataUrl = await qrcode.toDataURL(qr);
            if (clients[shopId]) {
                clients[shopId].qrCode = qrDataUrl;
                clients[shopId].status = 'QR_READY';
            }
        } catch (err) {
            console.error('Failed to generate QR code', err);
        }
    });

    client.on('ready', () => {
        console.log(`[Shop ${shopId}] Client is READY!`);
        if (clients[shopId]) {
            clients[shopId].status = 'READY';
            clients[shopId].qrCode = null;
        }
    });

    client.on('authenticated', () => {
        console.log(`[Shop ${shopId}] Authenticated!`);
        if (clients[shopId]) {
            clients[shopId].status = 'AUTHENTICATED';
        }
    });

    client.on('auth_failure', msg => {
        console.error(`[Shop ${shopId}] Authentication failure:`, msg);
        if (clients[shopId]) {
            clients[shopId].status = 'DISCONNECTED';
            clients[shopId].qrCode = null;
        }
    });

    client.on('disconnected', (reason) => {
        console.log(`[Shop ${shopId}] Client was disconnected:`, reason);
        if (clients[shopId]) {
            clients[shopId].status = 'DISCONNECTED';
            clients[shopId].qrCode = null;
            try {
                client.destroy();
            } catch (e) {
                // Ignore cleanup errors
            }
            delete clients[shopId];
        }
    });

    client.initialize().catch(err => {
        console.error(`[Shop ${shopId}] Failed to initialize:`, err);
        delete clients[shopId];
    });

    return clients[shopId];
}

// Health check
app.get('/health', (req, res) => {
    res.json({ ok: true, activeClients: Object.keys(clients).length });
});

// List all active sessions
app.get('/api/whatsapp/clients', (req, res) => {
    res.json({
        activeShops: Object.keys(clients).map(id => ({
            id,
            status: clients[id].status
        }))
    });
});

// 1. Get Status / QR Code
app.get('/api/whatsapp/:shopId/status', (req, res) => {
    const { shopId } = req.params;
    let session = clients[shopId];

    // If not in memory but saved session exists on disk, auto-restore
    if (!session) {
        const sessionPath = path.join(__dirname, '.wwebjs_auth', `session-${shopId}`);
        if (fs.existsSync(sessionPath)) {
            console.log(`[Shop ${shopId}] Found saved session on disk, auto-restoring...`);
            session = initClient(shopId);
        }
    }

    if (!session) {
        return res.json({ status: 'NOT_INITIALIZED' });
    }

    return res.json({
        status: session.status,
        qrCode: session.qrCode
    });
});

// 2. Initialize connection
app.post('/api/whatsapp/:shopId/init', (req, res) => {
    const { shopId } = req.params;
    initClient(shopId);
    return res.json({ success: true, message: 'Initialization started.' });
});

// 3. Logout / Disconnect
app.post('/api/whatsapp/:shopId/logout', async (req, res) => {
    const { shopId } = req.params;
    const session = clients[shopId];
    if (session && session.client) {
        try {
            await session.client.logout();
            delete clients[shopId];
        } catch (err) {
            console.error('Logout error:', err);
        }
    }
    return res.json({ success: true, message: 'Logged out.' });
});

// 4. Send Message (with optional PDF base64)
app.post('/api/whatsapp/:shopId/send', async (req, res) => {
    const { shopId } = req.params;
    const { phone, message, pdfBase64, filename } = req.body;

    let session = clients[shopId];

    // Auto-restore if session exists on disk
    if (!session) {
        const sessionPath = path.join(__dirname, '.wwebjs_auth', `session-${shopId}`);
        if (fs.existsSync(sessionPath)) {
            session = initClient(shopId);
        }
    }

    if (!session || session.status !== 'READY') {
        return res.status(400).json({ error: 'WhatsApp is not connected or ready.' });
    }

    if (!phone) {
        return res.status(400).json({ error: 'Phone number is required.' });
    }

    try {
        // Clean digits and ensure Indian country code (91) if 10-digit number is provided
        let cleanPhone = phone.replace(/\D/g, '');
        if (cleanPhone.length === 10) {
            cleanPhone = `91${cleanPhone}`;
        }
        const formattedPhone = phone.includes('@c.us') ? phone : `${cleanPhone}@c.us`;

        let sentMessage;

        if (pdfBase64) {
            // Remove data URL prefix if present
            const base64Data = pdfBase64.includes(',') ? pdfBase64.split(',')[1] : pdfBase64;
            const media = new MessageMedia('application/pdf', base64Data, filename || 'Invoice.pdf');
            
            try {
                // Send PDF document with caption
                sentMessage = await session.client.sendMessage(formattedPhone, media, {
                    caption: message,
                    sendMediaAsDocument: true
                });
            } catch (mediaErr) {
                console.warn(`[Shop ${shopId}] Document send failed (${mediaErr.message}), falling back to direct text bill...`);
                // If WhatsApp Web media engine fails, send the text bill directly so customer still receives the invoice!
                sentMessage = await session.client.sendMessage(formattedPhone, message);
            }
        } else {
            // Send text only
            sentMessage = await session.client.sendMessage(formattedPhone, message);
        }

        return res.json({ success: true, messageId: sentMessage?.id?._serialized || 'sent' });
    } catch (error) {
        console.error(`[Shop ${shopId}] Failed to send message:`, error);
        return res.status(500).json({ error: 'Failed to send message via WhatsApp' });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`WhatsApp Microservice running on port ${PORT}`);

    // Auto-restore any existing sessions on disk on startup
    const authDir = path.join(__dirname, '.wwebjs_auth');
    if (fs.existsSync(authDir)) {
        try {
            const entries = fs.readdirSync(authDir, { withFileTypes: true });
            entries.forEach(entry => {
                if (entry.isDirectory() && entry.name.startsWith('session-')) {
                    const shopId = entry.name.replace('session-', '');
                    console.log(`[Startup] Restoring saved session for shop: ${shopId}`);
                    initClient(shopId);
                }
            });
        } catch (e) {
            console.error('Failed to auto-restore sessions:', e);
        }
    }
});
