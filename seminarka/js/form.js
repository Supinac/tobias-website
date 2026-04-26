const API_URL = '/api/airsoft-contact';

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('kontakt-formular');
    if (!form) return;

    const status = document.getElementById('form-status');
    const submitBtn = document.getElementById('submit-btn');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const preferovanyKontakt = form.querySelector('input[name="preferovany-kontakt"]:checked');

        const formData = {
            jmeno:             document.getElementById('jmeno').value,
            email:             document.getElementById('email').value,
            vek:               document.getElementById('vek').value,
            kategorie:         document.getElementById('kategorie').value,
            preferovanyKontakt: preferovanyKontakt ? preferovanyKontakt.value : 'neuvedeno',
            zprava:            document.getElementById('zprava').value,
            newsletter:        document.getElementById('newsletter').checked,
        };

        setStatus('posilam', 'Odesílám zprávu…');
        submitBtn.disabled = true;

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            if (response.ok) {
                setStatus('uspech', 'Zpráva odeslána! Ozveme se co nejdříve.');
                form.reset();
            } else {
                setStatus('chyba', 'Odeslání selhalo. Zkuste to prosím znovu.');
            }
        } catch {
            setStatus('chyba', 'Chyba připojení. Zkontrolujte internet a zkuste znovu.');
        } finally {
            submitBtn.disabled = false;
        }
    });

    function setStatus(type, text) {
        status.textContent = text;
        status.className = 'form-status form-status--' + type;
    }
});
