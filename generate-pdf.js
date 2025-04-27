const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function generatePDF(outputPath) {
    let browser;
    try {
        console.log('Starting PDF generation...');
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        console.log('Browser launched successfully');

        const page = await browser.newPage();
        console.log('New page created');

        const htmlPath = path.join(__dirname, 'public/index.html');
        console.log('Reading HTML file from:', htmlPath);
        const htmlContent = fs.readFileSync(htmlPath, 'utf8');
        console.log('HTML file read successfully');

        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        console.log('Page content set successfully');

        await page.waitForSelector('#home');
        await page.waitForSelector('#resume');
        await page.waitForSelector('#projects');
        console.log('All required sections found');

        const content = await page.evaluate(() => {
            const homeSection = document.querySelector('#home');
            const resumeSection = document.querySelector('#resume');
            const downloadButton = resumeSection.querySelector('.resume-actions');
            if (downloadButton) downloadButton.remove();
            const resumeHeader = resumeSection.querySelector('h2');
            if (resumeHeader) resumeHeader.remove();

            const projectsSection = document.querySelector('#projects');

            return {
                home: homeSection.outerHTML,
                resume: resumeSection.outerHTML,
                projects: projectsSection.outerHTML
            };
        });
        console.log('Content extracted successfully');

        await page.setContent(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
                <style>
                    /* ... existing styles ... */
                </style>
            </head>
            <body>
                <div class="hero-content">
                    ${content.home}
                </div>
                <div class="contact-info">
                    <h2>Contact</h2>
                    <div class="contact-item">
                        <a href="mailto:jpranav97@gmail.com">jpranav97@gmail.com</a>
                        <a href="tel:+918123310664">+91-8123310664</a>
                        <a href="https://www.linkedin.com/in/pranav-jagadish-9392137a/" target="_blank" class="social-link">
                            www.linkedin.com/in/pranav-jagadish-9392137a/
                        </a>
                        <a href="https://github.com/Pranavj17" target="_blank" class="social-link">
                            github.com/Pranavj17
                        </a>
                    </div>
                </div>
                ${content.resume}
                <div class="section-divider"></div>
                <div class="skills">
                    <h2>Skills</h2>
                    <div class="skills-grid">
                        <div class="skill-item">Elixir / Phoenix</div>
                        <div class="skill-item">Ruby on Rails</div>
                        <div class="skill-item">Kafka</div>
                        <div class="skill-item">Redis Cache</div>
                        <div class="skill-item">Javascript</div>
                        <div class="skill-item">React</div>
                        <div class="skill-item">Redux</div>
                        <div class="skill-item">Grafana</div>
                        <div class="skill-item">Microservices</div>
                        <div class="skill-item">Umbrella Applications</div>
                        <div class="skill-item">K9s - Kubernetes</div>
                        <div class="skill-item">SQL</div>
                        <div class="skill-item">PostgreSQL</div>
                        <div class="skill-item">HTML</div>
                        <div class="skill-item">CSS</div>
                        <div class="skill-item">Socket.io</div>
                        <div class="skill-item">Docker</div>
                    </div>
                </div>
                ${content.projects}
                <div class="interests">
                    <h2>Interests</h2>
                    <p>Off the clock, I'm usually playing football or cricket, training for my next marathon, or catching up with the startup scene at conferences.</p>
                </div>
                <div class="declaration">
                    <h2>Declaration</h2>
                    <p>I hereby declare that all the information provided in this resume is true to the best of my knowledge and belief.</p>
                </div>
            </body>
            </html>
        `, { waitUntil: 'networkidle0' });
        console.log('PDF content set successfully');

        const pdf = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '0.5in',
                right: '0.5in',
                bottom: '0.5in',
                left: '0.5in'
            }
        });
        console.log('PDF generated successfully');

        // Create directory if it doesn't exist
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // Save the PDF
        fs.writeFileSync(outputPath, pdf);
        console.log('PDF saved successfully at:', outputPath);

        return outputPath;
    } catch (error) {
        console.error('Error generating PDF:', error);
        console.error('Error stack:', error.stack);
        throw error;
    } finally {
        if (browser) {
            try {
                await browser.close();
                console.log('Browser closed');
            } catch (error) {
                console.error('Error closing browser:', error);
            }
        }
    }
}

// Export the function
module.exports = generatePDF;

// If this file is run directly, generate the PDF
if (require.main === module) {
    const outputPath = process.argv[2] || path.join(__dirname, 'output', 'resume.pdf');
    generatePDF(outputPath)
        .then(outputPath => {
            console.log('PDF generated successfully at:', outputPath);
        })
        .catch(error => {
            console.error('Failed to generate PDF:', error);
            process.exit(1);
        });
}
