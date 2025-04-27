const express = require('express');
const path = require('path');
const app = express();
const pdfRouter = require('./routes/pdf');
const generatePDF = require('./generate-pdf');

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Use PDF routes
app.use('/api', pdfRouter);

// Download PDF route
app.get('/download', async (req, res) => {
    try {
        const outputPath = path.join(__dirname, 'public', 'resume.pdf');
        await generatePDF(outputPath);
        res.download(outputPath, 'resume.pdf');
    } catch (error) {
        console.error('Error downloading PDF:', error);
        res.status(500).json({ error: 'Failed to download PDF' });
    }
});

// Serve the main HTML file from root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Catch-all route to handle client-side routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Use environment variable for port or default to 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});