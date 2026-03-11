async function updateVisitCounter() {
    try {
        const counterElement = document.getElementById('visit-counter');
        if (counterElement) {
            // Show loading animation with dots
            counterElement.textContent = 'Loading';
            counterElement.classList.add('loading');
        }
        
        const response = await fetch('/api/visit');
        const data = await response.json();

        if (counterElement) {
            // Remove loading animation
            counterElement.classList.remove('loading');
            
            // Add transition for smooth animation
            counterElement.style.transition = 'transform 0.3s ease-in-out';
            
            // Scale down
            counterElement.style.transform = 'scale(0.95)';
            
            // Update text and scale back up
            setTimeout(() => {
                counterElement.textContent = `Total visits: ${data.visits}`;
                counterElement.style.transform = 'scale(1)';
            }, 150);
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