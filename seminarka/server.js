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

app.post('/api/airsoft-contact', async (req, res) => {
    try {
        const { jmeno, email, vek, kategorie, preferovanyKontakt, zprava, newsletter } = req.body;
        const ip = req.headers['x-forwarded-for'] ||
                   req.headers['x-real-ip'] ||
                   req.socket.remoteAddress ||
                   'Unknown';
        const os = parseUserAgent(req.headers['user-agent'] || 'Unknown');
        const timestamp = new Date().toISOString();

        const discordMessage = {
            embeds: [{
                title: '📋 Seminárka – nová zpráva z kontaktního formuláře',
                color: 0x2b5d3a,
                fields: [
                    { name: 'Jméno',              value: jmeno || '—',                                                                  inline: false },
                    { name: 'E-mail',             value: email || '—',                                                                  inline: true  },
                    { name: 'Věk',                value: vek   || '—',                                                                  inline: true  },
                    { name: 'Kategorie dotazu',   value: kategorie || '—',                                                              inline: false },
                    { name: 'Pref. kontakt',      value: preferovanyKontakt || '—',                                                     inline: true  },
                    { name: 'Newsletter',         value: newsletter ? 'Ano' : 'Ne',                                                     inline: true  },
                    { name: 'Zpráva',             value: zprava ? (zprava.length > 1024 ? zprava.substring(0, 1021) + '…' : zprava) : '—', inline: false },
                    { name: 'IP adresa',          value: ip,                                                                            inline: true  },
                    { name: 'OS',                 value: os,                                                                            inline: true  },
                    { name: 'Čas',                value: timestamp,                                                                     inline: false },
                ],
                footer: { text: 'Airsoft & Vzduchovky – Seminární práce' }
            }]
        };

        await axios.post(DISCORD_WEBHOOK_URL, discordMessage);
        res.json({ success: true });
    } catch (error) {
        console.error('Error handling contact form:', error);
        res.status(500).json({ success: false });
    }
});

app.listen(PORT, () => {
    console.log(`Seminarka server running on http://localhost:${PORT}`);
});
