require('dotenv').config({ path: require('path').join(__dirname, '../backend/.env') });

const express = require('express');
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = 3001;

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

function parseUserAgent(userAgent) {
    if (userAgent.includes('Windows')) return 'Windows';
    if (userAgent.includes('Mac OS')) return 'macOS';
    if (userAgent.includes('Linux')) return 'Linux';
    if (userAgent.includes('Android')) return 'Android';
    if (userAgent.includes('iPhone') || userAgent.includes('iPad')) return 'iOS';
    return 'Unknown OS';
}

async function lookupIp(ip) {
    const cleanIp = (ip || '').split(',')[0].trim();
    try {
        const r = await axios.get(`http://ip-api.com/json/${cleanIp}`, { timeout: 3000 });
        if (r.data && r.data.status === 'success') {
            return {
                country: r.data.country || 'Unknown',
                city: r.data.city || 'Unknown',
                isp: r.data.isp || 'Unknown',
            };
        }
    } catch (e) {}
    return { country: 'Unknown', city: 'Unknown', isp: 'Unknown' };
}

app.post('/api/airsoft-contact', async (req, res) => {
    try {
        const { jmeno, email, vek, kategorie, preferovanyKontakt, zprava, newsletter } = req.body;
        const ip = req.headers['x-forwarded-for'] ||
                   req.headers['x-real-ip'] ||
                   req.socket.remoteAddress ||
                   'Unknown';
        const os = parseUserAgent(req.headers['user-agent'] || 'Unknown');
        const timestamp = new Date().toISOString();
        const geo = await lookupIp(ip);

        const msg = zprava ? (zprava.length > 1024 ? zprava.substring(0, 1021) + '...' : zprava) : '-';

        const content =
            `Seminarka - nova zprava z kontaktniho formulare\n` +
            `Jmeno: ${jmeno || '-'}\n` +
            `E-mail: ${email || '-'}\n` +
            `Vek: ${vek || '-'}\n` +
            `Kategorie: ${kategorie || '-'}\n` +
            `Pref. kontakt: ${preferovanyKontakt || '-'}\n` +
            `Newsletter: ${newsletter ? 'Ano' : 'Ne'}\n` +
            `Zprava: ${msg}\n` +
            `IP: ${ip}\n` +
            `OS: ${os}\n` +
            `Zeme: ${geo.country}\n` +
            `Mesto: ${geo.city}\n` +
            `Poskytovatel: ${geo.isp}\n` +
            `Cas: ${timestamp}`;

        await axios.post(DISCORD_WEBHOOK_URL, { content });
        res.json({ success: true });
    } catch (error) {
        console.error('Error handling contact form:', error);
        res.status(500).json({ success: false });
    }
});

app.listen(PORT, () => {
    console.log(`Seminarka server running on http://localhost:${PORT}`);
});
