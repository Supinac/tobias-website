async function updateVisitCounter() {
    try {
        const response = await fetch('/api/visit');
        const data = await response.json();

        const counterElement = document.getElementById('visit-counter');
        if (counterElement) {
            counterElement.textContent = `Total visits: ${data.visits}`;
        }
    } catch (error) {
        console.error('Failed to fetch visit count:', error);
    }
}

const contactForm = document.getElementById('contact-form');
if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const statusDiv = document.getElementById('form-status');
        statusDiv.textContent = 'Sending message...';
        statusDiv.style.color = 'blue';
        
        // Get form data
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

// Call visit counter on page load (if the element exists)
if (document.getElementById('visit-counter')) {
    updateVisitCounter();
}