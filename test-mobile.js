const puppeteer = require('puppeteer');

async function testMobileNavigation() {
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();

        // Set mobile viewport
        await page.setViewport({
            width: 375,
            height: 812,
            deviceScaleFactor: 2,
            isMobile: true,
            hasTouch: true
        });

        // Navigate to the page
        await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });

        // Test 1: Check if home is active by default
        console.log('Test 1: Checking if home is active by default');
        const homeActive = await page.evaluate(() => {
            const homeNav = document.querySelector('.nav-item[href="#home"]');
            return homeNav.classList.contains('active');
        });
        console.log('Home active by default:', homeActive);

        // Test 2: Click resume tab and check active state
        console.log('\nTest 2: Clicking resume tab');
        await page.click('.nav-item[href="#resume"]');
        await page.waitForTimeout(1000); // Wait for animation

        const resumeActive = await page.evaluate(() => {
            const resumeNav = document.querySelector('.nav-item[href="#resume"]');
            return resumeNav.classList.contains('active');
        });
        console.log('Resume active after click:', resumeActive);

        // Test 3: Click projects tab and check active state
        console.log('\nTest 3: Clicking projects tab');
        await page.click('.nav-item[href="#projects"]');
        await page.waitForTimeout(1000);

        const projectsActive = await page.evaluate(() => {
            const projectsNav = document.querySelector('.nav-item[href="#projects"]');
            return projectsNav.classList.contains('active');
        });
        console.log('Projects active after click:', projectsActive);

        // Test 4: Check if FAB button is visible
        console.log('\nTest 4: Checking FAB button visibility');
        const fabVisible = await page.evaluate(() => {
            const fab = document.querySelector('.fab-button');
            const style = window.getComputedStyle(fab);
            return style.display !== 'none';
        });
        console.log('FAB button visible:', fabVisible);

        // Test 5: Check if mobile navigation is visible
        console.log('\nTest 5: Checking mobile navigation visibility');
        const mobileNavVisible = await page.evaluate(() => {
            const mobileNav = document.querySelector('.mobile-nav');
            const style = window.getComputedStyle(mobileNav);
            return style.display !== 'none';
        });
        console.log('Mobile navigation visible:', mobileNavVisible);

        // Take a screenshot for visual verification
        await page.screenshot({ path: 'mobile-test.png' });
        console.log('\nScreenshot saved as mobile-test.png');

    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        await browser.close();
    }
}

testMobileNavigation();