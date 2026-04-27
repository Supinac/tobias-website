async function updateVisitCounter() {
    try {
        const counterElement = document.getElementById('visit-counter');
        if (counterElement) {
            counterElement.textContent = 'Loading';
            counterElement.classList.add('loading');
        }

        const response = await fetch('/api/visit');
        const data = await response.json();

        if (counterElement) {
            counterElement.classList.remove('loading');
            counterElement.style.transition = 'transform 0.3s ease-in-out';
            counterElement.style.transform = 'scale(0.95)';
            setTimeout(() => {
                counterElement.textContent = `Total visits: ${data.visits}`;
                counterElement.style.transform = 'scale(1)';
            }, 150);
        }
    } catch (error) {
        console.error('Failed to fetch visit count:', error);
    }
}

if (document.getElementById('visit-counter')) {
    updateVisitCounter();
}

const contactForm = document.getElementById('contact-form');
if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const statusDiv = document.getElementById('form-status');
        statusDiv.textContent = 'Sending message...';
        statusDiv.style.color = 'blue';

        const formData = {
            name: document.getElementById('name').value,
            contact: document.getElementById('contact').value,
            message: document.getElementById('message').value
        };

        try {
            const response = await fetch('/api/contact', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                statusDiv.textContent = 'Message sent successfully! I\'ll get back to you soon.';
                statusDiv.style.color = 'green';
                contactForm.reset();
            } else {
                statusDiv.textContent = 'Failed to send message. Please try again.';
                statusDiv.style.color = 'red';
            }
        } catch (error) {
            console.error('Error sending message:', error);
            statusDiv.textContent = 'Error sending message. Please try again later.';
            statusDiv.style.color = 'red';
        }
    });
}
