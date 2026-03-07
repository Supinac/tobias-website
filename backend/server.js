require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = 3000;

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

const COUNTER_FILE = path.join(__dirname, 'visit-count.txt');

// Track visitors - only count and notify once per IP per hour
const recentVisitors = new Map();
const VISITOR_COOLDOWN = 60 * 60 * 1000; // 1 hour in ms

function isNewVisitor(ip) {
    const lastVisit = recentVisitors.get(ip);
    const now = Date.now();
    if (!lastVisit || (now - lastVisit) > VISITOR_COOLDOWN) {
        recentVisitors.set(ip, now);
        return true;
    }
    return false;
}

app.use(express.json());

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

function getCount() {
    try {
        if (fs.existsSync(COUNTER_FILE)) {
            const data = fs.readFileSync(COUNTER_FILE, 'utf8');
            return parseInt(data) || 0;
        }
        return 0;
    } catch (error) {
        console.error('Error reading count:', error);
        return 0;
    }
}

function saveCount(count) {
    try {
        fs.writeFileSync(COUNTER_FILE, count.toString());
    } catch (error) {
        console.error('Error saving count:', error);
    }
}

function parseUserAgent(userAgent) {
    if (userAgent.includes('Windows')) return 'Windows';
    if (userAgent.includes('Mac OS')) return 'macOS';
    if (userAgent.includes('Linux')) return 'Linux';
    if (userAgent.includes('Android')) return 'Android';
    if (userAgent.includes('iPhone') || userAgent.includes('iPad')) return 'iOS';
    return 'Unknown OS';
}

app.get('/api/visit', async (req, res) => {
    const ip = req.headers['x-forwarded-for'] || 
               req.headers['x-real-ip'] || 
               req.connection.remoteAddress || 
               'Unknown';
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const os = parseUserAgent(userAgent);

    let count = getCount();

    if (isNewVisitor(ip)) {
        count++;
        saveCount(count);

        if (DISCORD_WEBHOOK_URL) {
            try {
                await axios.post(DISCORD_WEBHOOK_URL, {
                    embeds: [{
                        title: 'New Visitor',
                        color: 0x3498db,
                        fields: [
                            { name: 'Visit #', value: count.toString(), inline: true },
                            { name: 'IP', value: ip, inline: true },
                            { name: 'OS', value: os, inline: true },
                            { name: 'Timestamp', value: new Date().toISOString(), inline: false }
                        ],
                        footer: { text: 'Website Visit Notification' }
                    }]
                });
            } catch (err) {
                console.error('Discord visit notification failed:', err.message);
            }
        }
    }

    res.json({ visits: count });
});

app.post('/api/contact', async (req, res) => {
    try {
        const { name, contact, message } = req.body;
        const ip = req.headers['x-forwarded-for'] || 
                   req.headers['x-real-ip'] || 
                   req.connection.remoteAddress || 
                   'Unknown';
        const userAgent = req.headers['user-agent'] || 'Unknown';
        const os = parseUserAgent(userAgent);
        
        const timestamp = new Date().toISOString();
        
        console.log('Contact form submitted:', { name, contact, ip, os });
        
        // Send to Discord
        const discordMessage = {
            embeds: [{
                title: 'Contact web from webhook',
                color: 0x00ff00,
                fields: [
                    {
                        name: 'Name',
                        value: name,
                        inline: false
                    },
                    {
                        name: 'Contact me back on',
                        value: contact,
                        inline: false
                    },
                    {
                        name: 'Message',
                        value: message.length > 1024 ? message.substring(0, 1021) + '...' : message,
                        inline: false
                    },
                    {
                        name: 'IP Address',
                        value: ip,
                        inline: true
                    },
                    {
                        name: 'Operating System',
                        value: os,
                        inline: true
                    },
                    {
                        name: 'Timestamp',
                        value: timestamp,
                        inline: false
                    }
                ],
                footer: {
                    text: 'Website Contact Form'
                }
            }]
        };
        
        await axios.post(DISCORD_WEBHOOK_URL, discordMessage);
        
        res.json({ success: true, message: 'Message sent successfully' });
        
    } catch (error) {
        console.error('Error handling contact form:', error);
        res.status(500).json({ success: false, message: 'Failed to send message' });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Visit counter API running on port ${PORT}`);
});
