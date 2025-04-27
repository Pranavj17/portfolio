const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

async function generatePDF() {
    try {
        console.log('Starting PDF generation...');

        // Launch browser
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        // Create new page
        const page = await browser.newPage();

        // Set viewport
        await page.setViewport({
            width: 1200,
            height: 1600
        });

        // Read the HTML content
        const htmlPath = path.join(__dirname, 'public', 'index.html');
        const htmlContent = fs.readFileSync(htmlPath, 'utf8');

        // Set content
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

        // Wait for fonts to load
        await page.evaluate(() => document.fonts.ready);

        // Generate PDF
        const pdfPath = path.join(__dirname, 'output', 'resume.pdf');

        // Ensure output directory exists
        if (!fs.existsSync(path.join(__dirname, 'output'))) {
            fs.mkdirSync(path.join(__dirname, 'output'));
        }

        // Generate PDF
        await page.pdf({
            path: pdfPath,
            format: 'A4',
            printBackground: true,
            margin: {
                top: '0.5in',
                right: '0.5in',
                bottom: '0.5in',
                left: '0.5in'
            }
        });

        console.log(`PDF generated successfully at: ${pdfPath}`);

        // Close browser
        await browser.close();

    } catch (error) {
        console.error('Error generating PDF:', error);
    }
}

// Run the test
generatePDF();