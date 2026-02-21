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
updateVisitCounter();