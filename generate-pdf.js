const puppeteer = require('puppeteer');
const path = require('path');

async function generatePDF() {
    try {
        console.log('Starting PDF generation...');
        const browser = await puppeteer.launch();
        const page = await browser.newPage();

        // Load the template
        await page.goto(`file:${path.join(__dirname, 'public', 'pdf-template.html')}`, {
            waitUntil: 'networkidle0'
        });

        // Wait for fonts to load
        await page.evaluate(() => document.fonts.ready);

        // Generate PDF
        await page.pdf({
            path: path.join(__dirname, 'public', 'resume.pdf'),
            format: 'A4',
            printBackground: true,
            margin: {
                top: '40px',
                right: '40px',
                bottom: '40px',
                left: '40px'
            }
        });

        console.log('PDF generated successfully!');
        await browser.close();
    } catch (error) {
        console.error('Error generating PDF:', error);
        process.exit(1);
    }
}

generatePDF();