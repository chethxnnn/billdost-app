const express = require('express');
const cors = require('cors');
const qrcode = require('qrcode');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

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
            // Optionally remove or allow re-init
            client.destroy();
            delete clients[shopId];
        }
    });

    client.initialize().catch(err => {
        console.error(`[Shop ${shopId}] Failed to initialize:`, err);
        delete clients[shopId];
    });

    return clients[shopId];
}

// 1. Get Status / QR Code
app.get('/api/whatsapp/:shopId/status', (req, res) => {
    const { shopId } = req.params;
    const session = clients[shopId];

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

    const session = clients[shopId];

    if (!session || session.status !== 'READY') {
        return res.status(400).json({ error: 'WhatsApp is not connected or ready.' });
    }

    if (!phone) {
        return res.status(400).json({ error: 'Phone number is required.' });
    }

    try {
        // Format phone number to standard WhatsApp format (e.g., 919876543210@c.us)
        const formattedPhone = phone.includes('@c.us') ? phone : `${phone.replace(/\D/g, '')}@c.us`;

        let sentMessage;

        if (pdfBase64) {
            // Remove data URL prefix if present
            const base64Data = pdfBase64.includes(',') ? pdfBase64.split(',')[1] : pdfBase64;
            const media = new MessageMedia('application/pdf', base64Data, filename || 'Invoice.pdf');
            
            // Send Media with caption
            sentMessage = await session.client.sendMessage(formattedPhone, media, { caption: message });
        } else {
            // Send text only
            sentMessage = await session.client.sendMessage(formattedPhone, message);
        }

        return res.json({ success: true, messageId: sentMessage.id._serialized });
    } catch (error) {
        console.error(`[Shop ${shopId}] Failed to send message:`, error);
        return res.status(500).json({ error: 'Failed to send message via WhatsApp' });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`WhatsApp Microservice running on port ${PORT}`);
});
