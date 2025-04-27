const express = require('express');
const path = require('path');
const pdfRouter = require('./routes/pdf');

const app = express();
const PORT = process.env.PORT || 3000;

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).send('Something went wrong!');
});

// Serve static files
app.use(express.static(path.join(__dirname)));

// Use the PDF generation route
app.use('/api', pdfRouter);

// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT} to view your portfolio`);
    console.log(`PDF generation available at http://localhost:${PORT}/api/resume`);
});