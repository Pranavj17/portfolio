const express = require('express');
const router = express.Router();
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

router.get('/resume', async (req, res) => {
    let browser;
    try {
        console.log('Starting PDF generation...');
        console.log('Current working directory:', process.cwd());
        console.log('Chrome path:', process.env.CHROME_BIN);

        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--no-first-run',
                '--no-zygote',
                '--single-process'
            ],
            executablePath: process.env.CHROME_BIN || null
        });
        console.log('Browser launched successfully');

        const page = await browser.newPage();
        console.log('New page created');

        const htmlPath = path.join(__dirname, '../public/index.html');
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
            // Remove the Resume header
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
                    body {
                        font-family: 'Poppins', sans-serif;
                        line-height: 1.3;
                        color: #1a1a1a;
                        padding: 1.25rem;
                        margin: 0;
                        font-size: 10pt;
                    }
                    h1 {
                        color: #3498db;
                        font-size: 20pt;
                        margin: 0 0 0.25rem 0;
                        text-align: center;
                    }
                    h2 {
                        color: #3498db;
                        font-size: 14pt;
                        margin: 0.75rem 0 0.25rem 0;
                        text-align: left;
                        border-bottom: 1px solid #3498db;
                        padding-bottom: 0.25rem;
                    }
                    [data-id="resume-header"] {
                        color: #3498db;
                        font-size: 14pt;
                        margin: 0.75rem 0 0.25rem 0;
                        text-align: left;
                        border-bottom: 1px solid #3498db;
                        padding-bottom: 0.25rem;
                    }
                    h3 {
                        color: #3498db;
                        font-size: 11pt;
                        margin: 0.5rem 0 0.25rem 0;
                    }
                    h4 {
                        color: #3498db;
                        font-size: 11pt;
                        margin: 0.25rem 0;
                    }
                    p {
                        margin: 0.25rem 0;
                    }
                    .hero-content {
                        text-align: center;
                        margin-bottom: 0.5rem;
                    }
                    .hero-description {
                        font-size: 12pt;
                        margin: 0.25rem 0;
                    }
                    .hero-experience {
                        font-size: 10pt;
                        margin: 0.25rem 0;
                        padding: 0.25rem;
                        background: rgba(52, 152, 219, 0.05);
                        border-radius: 4px;
                    }
                    .hero-skills {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 0.25rem;
                        margin: 0.25rem 0;
                        justify-content: center;
                    }
                    .skill-tag {
                        background: #3498db;
                        color: white;
                        padding: 0.15rem 0.5rem;
                        border-radius: 12px;
                        font-size: 9pt;
                    }
                    .resume-item {
                        margin-bottom: 0.5rem;
                    }
                    .company, .institution, .location {
                        font-style: italic;
                        color: #666;
                        margin: 0.15rem 0;
                        font-size: 9pt;
                    }
                    .date {
                        color: #666;
                        font-size: 9pt;
                        margin: 0.15rem 0;
                    }
                    ul {
                        margin: 0.25rem 0;
                        padding-left: 1.25rem;
                    }
                    li {
                        margin: 0.15rem 0;
                        font-size: 9pt;
                    }
                    .project-item {
                        margin-bottom: 0.5rem;
                    }
                    .project-item h3 {
                        margin: 0.5rem 0 0.25rem 0;
                        font-size: 11pt;
                    }
                    .project-item ul {
                        list-style: none;
                        padding-left: 0;
                    }
                    .project-item li {
                        margin: 0.25rem 0;
                    }
                    .project-item a {
                        color: #3498db;
                        text-decoration: none;
                    }
                    .contact-info {
                        margin: 1rem 0;
                    }
                    .contact-item {
                        display: grid;
                        grid-template-columns: repeat(4, 1fr);
                        gap: 1rem;
                        margin: 0.5rem 0;
                    }
                    .contact-item a {
                        color: #666;
                        text-decoration: none;
                        font-size: 9pt;
                        display: flex;
                        align-items: center;
                    }
                    .contact-item a:hover {
                        color: #3498db;
                    }
                    .social-link {
                        color: #666;
                        text-decoration: none;
                        font-size: 9pt;
                    }
                    .social-link:hover {
                        color: #3498db;
                    }
                    .skills-grid {
                        display: grid;
                        grid-template-columns: repeat(4, 1fr);
                        gap: 0.25rem;
                        margin: 0.25rem 0;
                    }
                    .skill-item {
                        font-size: 9pt;
                    }
                    .interests, .declaration {
                        margin-top: 0.75rem;
                        padding-top: 0.5rem;
                        border-top: 1px solid #e0e0e0;
                    }
                    .interests p, .declaration p {
                        font-size: 9pt;
                        margin: 0.25rem 0;
                    }
                    .page-break {
                        page-break-before: always;
                    }
                    .section-divider {
                        margin: 0.75rem 0;
                        border-top: 1px solid #e0e0e0;
                    }
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

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=resume.pdf');
        res.send(pdf);
    } catch (error) {
        console.error('Error generating PDF:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({
            error: 'Failed to generate PDF',
            details: error.message,
            stack: error.stack
        });
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
});

module.exports = router;