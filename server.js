const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Serve static files from the public directory
app.use(express.static('public'));

// Serve index.html for the root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Handle PDF download
app.get('/download-resume', (req, res) => {
    const filePath = path.join(__dirname, 'public', 'resume.pdf');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=resume.pdf');
    res.sendFile(filePath);
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});