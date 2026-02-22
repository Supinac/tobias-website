const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = 3000;

const DISCORD_WEBHOOK_URL = 'https://discordapp.com/api/webhooks/1474913365259456663/npoMe40RBux_XQOY5Inofdhkqd5_6AbreyV0iLs4urQjaKr82LtEleKGOe2f_U3s4gsD';

const COUNTER_FILE = path.join(__dirname, 'visit-count.txt');

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

app.get('/api/visit', (req, res) => {
    let count = getCount();
    count++;
    saveCount(count);
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