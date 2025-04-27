const express = require('express');
const path = require('path');
const app = express();
const pdfRouter = require('./routes/pdf');

// Serve static files
app.use(express.static(path.join(__dirname)));

// Use PDF routes
app.use('/api', pdfRouter);

// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT} to view your portfolio`);
    console.log(`PDF generation available at http://localhost:${PORT}/api/resume`);
});