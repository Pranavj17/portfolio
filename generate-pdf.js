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
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body {
                        font-family: 'Poppins', sans-serif;
                        line-height: 1.4;
                        color: #1a1a1a;
                        background: #ffffff;
                        font-size: 10pt;
                    }
                    p { margin: 0; padding: 0; line-height: 1.3; }

                    /* ── Header / Hero ── */
                    .hero-section { padding: 0 0 10px 0; margin-bottom: 4px; border-bottom: 2px solid #3498db; }
                    .hero-content { max-width: 100%; padding: 0; animation: none; }
                    .name { font-size: 20pt; font-weight: 700; color: #3498db; text-align: center; margin-bottom: 1px; display: block; }
                    .hero-description { font-size: 9.5pt; color: #444; text-align: center; margin-bottom: 2px; font-weight: 500; }
                    .hero-experience { font-size: 8.5pt; color: #555; text-align: center; margin: 0 auto 4px auto; padding: 4px 8px; background: #f0f7ff; border-radius: 3px; line-height: 1.35; max-width: 90%; }
                    .hero-skills { display: flex; justify-content: center; gap: 5px; flex-wrap: wrap; margin-bottom: 0; }
                    .skill-tag { background: #3498db; color: #fff; padding: 1px 9px; border-radius: 10px; font-size: 7.5pt; font-weight: 500; border: none; }

                    /* ── Contact ── */
                    .contact-info { padding: 5px 0; margin-bottom: 6px; border-bottom: 1px solid #e0e0e0; text-align: center; }
                    .contact-info h2 { display: none; }
                    .contact-item { display: flex; flex-wrap: wrap; gap: 0; align-items: center; justify-content: center; font-size: 8pt; line-height: 1.5; }
                    .contact-item a { color: #3498db; text-decoration: none; font-weight: 500; white-space: nowrap; }
                    .contact-item a::before { content: none; }
                    .contact-item a + a::before { content: " | "; color: #999; font-weight: 400; padding: 0 3px; }

                    /* ── Section Headers ── */
                    h2 { font-size: 12pt; color: #3498db; margin: 14px 0 6px 0; padding-bottom: 3px; border-bottom: 1.5px solid #3498db; text-align: left; position: relative; page-break-after: avoid; }
                    h2::after { display: none; }
                    h3 { font-size: 10pt; color: #3498db; margin: 0 0 2px 0; page-break-after: avoid; }
                    h4 { font-size: 10pt; color: #2c3e50; margin: 0 0 0 0; }

                    /* ── Resume ── */
                    .resume { padding: 0; background: none; }
                    .resume-content { max-width: 100%; }
                    .resume-section { margin-bottom: 8px; }
                    .resume-section h3 { font-size: 11pt; margin: 0 0 3px 0; padding-bottom: 1px; border-bottom: 1px solid #e0e0e0; }
                    .resume-item { background: none; padding: 0 0 6px 0; margin-bottom: 8px; box-shadow: none; border-radius: 0; }
                    .resume-item h4 { font-size: 10.5pt; color: #1a1a1a; font-weight: 600; line-height: 1.2; display: inline; }
                    .resume-item .company, .resume-item .institution { font-size: 9.5pt; font-weight: 500; color: #555; font-style: normal; line-height: 1.2; display: inline; }
                    .resume-item .company::before, .resume-item .institution::before { content: "  ·  "; color: #999; }
                    .resume-item .location { font-size: 8pt; color: #888; font-style: normal; line-height: 1.2; display: inline; white-space: pre-line; }
                    .resume-item .location::before { content: "\\A"; white-space: pre; }
                    .resume-item .date { font-size: 8pt; color: #888; margin-bottom: 1px; line-height: 1.2; display: inline; }
                    .resume-item .date::before { content: " · "; color: #ccc; }
                    .resume-item .cgpa { font-size: 8pt; color: #888; line-height: 1.2; display: inline; }
                    .resume-item .cgpa::before { content: " · "; color: #ccc; }
                    .resume-item ul { padding-left: 18px; margin-top: 3px; list-style-position: outside; }
                    .resume-item li { font-size: 9pt; line-height: 1.45; margin-bottom: 3px; color: #333; padding-left: 2px; }
                    .resume-item li strong { color: #1a1a1a; }

                    /* ── Skills ── */
                    .skills { margin: 0; padding: 0; }
                    .skills h2 { margin-top: 4px; }
                    .skills-grid { display: flex; flex-wrap: wrap; gap: 6px; }
                    .skill-item { background: #f0f7ff; color: #2c3e50; padding: 3px 10px; border-radius: 3px; font-size: 8.5pt; font-weight: 500; border: 1px solid #d0e4f5; }

                    /* ── Projects ── */
                    .projects { padding: 0; background: none; }
                    .project-grid { display: block; }
                    .project-item { background: none; padding: 0 0 4px 0; box-shadow: none; margin-bottom: 6px; page-break-inside: avoid; }
                    .project-item h3 { font-size: 10pt; color: #3498db; margin: 0 0 2px 0; padding-bottom: 1px; border-bottom: 1px solid #e0e0e0; }
                    .project-item ul { list-style: disc; padding-left: 18px; list-style-position: outside; }
                    .project-item li { font-size: 9pt; margin-bottom: 2px; padding-left: 2px; background: none; border-radius: 0; color: #333; line-height: 1.4; }
                    .project-item a { color: #3498db; text-decoration: none; font-weight: 600; }
                    .project-item em { color: #888; font-size: 8pt; }

                    /* ── Interests & Declaration ── */
                    .interests, .declaration { margin-top: 8px; }
                    .interests h2, .declaration h2 { font-size: 10pt; margin: 8px 0 4px 0; }
                    .interests p, .declaration p { font-size: 8.5pt; color: #555; line-height: 1.35; }

                    /* ── Section Divider ── */
                    .section-divider { border: none; margin: 0; padding: 0; }

                    /* ── Print Overrides ── */
                    .sidebar, .mobile-nav, .sidebar-nav, .sidebar-item { display: none !important; }
                    a { color: #3498db; text-decoration: none; }
                    @page { size: A4; }
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
                        <a href="https://medium.com/@jpranav97" target="_blank" class="social-link">
                            medium.com/@jpranav97
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
                        <div class="skill-item">Python (Learning)</div>
                        <div class="skill-item">JavaScript / TypeScript</div>
                        <div class="skill-item">AI/ML (Learning)</div>
                        <div class="skill-item">MCP</div>
                        <div class="skill-item">Claude API / Anthropic SDK</div>
                        <div class="skill-item">Kafka</div>
                        <div class="skill-item">Redis Cache</div>
                        <div class="skill-item">React</div>
                        <div class="skill-item">PostgreSQL</div>
                        <div class="skill-item">Microservices / OTP</div>
                        <div class="skill-item">Docker / Podman</div>
                        <div class="skill-item">Kubernetes</div>
                        <div class="skill-item">CI/CD (GitLab)</div>
                        <div class="skill-item">Grafana / Sentry / Graylog</div>
                        <div class="skill-item">SQL</div>
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
                right: '0.6in',
                bottom: '0.5in',
                left: '0.6in'
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
