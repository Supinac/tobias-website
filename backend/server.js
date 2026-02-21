// Import the Express framework for building web servers
const express = require('express');
const fs = require('fs');
const path = require('path');

// Create an Express application
const app = express();
const PORT = 3000;

// File to store the visit count
const COUNTER_FILE = path.join(__dirname, 'visit-count.txt');

// Function to read the current count from file
function getCount() {
    try {
        // If the file exists, read it and parse the number
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

// Function to save the count to file
function saveCount(count) {
    try {
        fs.writeFileSync(COUNTER_FILE, count.toString());
    } catch (error) {
        console.error('Error saving count:', error);
    }
}

// Enable CORS so your website can call this API
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET');
    next();
});

// API endpoint to get and increment the visit count
app.get('/api/visit', (req, res) => {
    // Get current count, increment it, and save
    let count = getCount();
    count++;
    saveCount(count);
    
    // Return the new count as JSON
    res.json({ visits: count });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Visit counter API running on port ${PORT}`);
});
