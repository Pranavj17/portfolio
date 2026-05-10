/**
 * Generate Pranav Jagadish's resume PDF from public/resume.html.
 * Outputs to TWO locations:
 *   1. ~/Documents/Pranav_Jagadish_Resume.pdf (local Mac, named for direct use)
 *   2. public/resume.pdf                       (committed to repo, served at /resume.pdf)
 *
 * Run:    node generate-resume.js
 * Notes:  Uses the Chrome for Testing binary cached by Puppeteer; falls
 *         back to the system Chrome if not present.
 */
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const os = require('os');

const HTML_PATH = path.join(__dirname, 'public', 'resume.html');
const REPO_OUT  = path.join(__dirname, 'public', 'resume.pdf');
const MAC_OUT   = path.join(os.homedir(), 'Documents', 'Pranav_Jagadish_Resume.pdf');

(async () => {
    if (!fs.existsSync(HTML_PATH)) {
        console.error('❌ resume.html missing at', HTML_PATH);
        process.exit(1);
    }

    console.log('▸ launching Chrome for Testing…');
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    const url = 'file://' + HTML_PATH;
    console.log('▸ loading', url);
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30_000 });

    // wait for IBM Plex Mono to be ready (Google Fonts can lag)
    await page.evaluateHandle('document.fonts.ready');

    console.log('▸ rendering PDF (US Letter · printBackground · preferCSSPageSize)…');
    const pdfBuffer = await page.pdf({
        format: 'letter',
        printBackground: true,
        preferCSSPageSize: true,    // honor @page in CSS for margins
        displayHeaderFooter: false,
    });

    await browser.close();

    fs.writeFileSync(REPO_OUT, pdfBuffer);
    fs.mkdirSync(path.dirname(MAC_OUT), { recursive: true });
    fs.writeFileSync(MAC_OUT, pdfBuffer);

    const sizeKB = (pdfBuffer.length / 1024).toFixed(1);
    console.log(`✓ ${REPO_OUT}  ·  ${sizeKB}KB`);
    console.log(`✓ ${MAC_OUT}   ·  ${sizeKB}KB`);
})().catch(err => {
    console.error('❌ generate-resume failed:', err.message);
    process.exit(1);
});
