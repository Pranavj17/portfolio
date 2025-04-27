// Prioritize LCP elements
document.addEventListener('DOMContentLoaded', function() {
    // Defer loading of non-critical resources
    requestIdleCallback(() => {
        // Load non-critical CSS
        const nonCriticalCSS = document.createElement('link');
        nonCriticalCSS.rel = 'stylesheet';
        nonCriticalCSS.href = 'styles.css';
        nonCriticalCSS.media = 'print';
        nonCriticalCSS.onload = function() {
            nonCriticalCSS.media = 'all';
        };
        document.head.appendChild(nonCriticalCSS);

        // Load Font Awesome
        const fontAwesome = document.createElement('link');
        fontAwesome.rel = 'stylesheet';
        fontAwesome.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css';
        fontAwesome.media = 'print';
        fontAwesome.onload = function() {
            fontAwesome.media = 'all';
        };
        document.head.appendChild(fontAwesome);
    });

    // Handle navigation clicks and active states
    document.querySelectorAll('.nav-item, .sidebar-nav-item').forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').slice(1);
            const targetSection = document.getElementById(targetId);
            const bottomNavHeight = document.querySelector('.mobile-nav')?.offsetHeight || 0;

            // Remove active class from all navigation items
            document.querySelectorAll('.nav-item, .sidebar-nav-item').forEach(item => {
                item.classList.remove('active');
            });

            // Add active class to clicked item
            this.classList.add('active');

            window.scrollTo({
                top: targetSection.offsetTop - bottomNavHeight,
                behavior: 'smooth'
            });
        });
    });

    // Set initial active state based on URL hash
    if (window.location.hash) {
        const targetId = window.location.hash.slice(1);
        const targetSection = document.getElementById(targetId);
        if (targetSection) {
            window.scrollTo({
                top: targetSection.offsetTop - (document.querySelector('.mobile-nav')?.offsetHeight || 0),
                behavior: 'smooth'
            });
        }
    }

    // Add event listeners for PDF download buttons
    document.getElementById('download').addEventListener('click', generateAndShowPDF);
    document.getElementById('download-mobile').addEventListener('click', generateAndShowPDF);
});

// Add active class to navigation links on scroll
window.addEventListener('scroll', () => {
    let current = '';
    const sections = document.querySelectorAll('section');

    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.clientHeight;
        if (pageYOffset >= sectionTop - 60) {
            current = section.getAttribute('id');
        }
    });

    document.querySelectorAll('.nav-links a').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href').slice(1) === current) {
            link.classList.add('active');
        }
    });
});

function generateAndShowPDF() {
    try {
        console.log('Starting PDF generation...');

        // Create an iframe to load the template
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.top = '0';
        iframe.style.left = '0';
        iframe.style.width = '100vw';
        iframe.style.height = '100vh';
        iframe.style.zIndex = '9999';
        iframe.style.border = 'none';
        iframe.style.background = '#ffffff';

        // Add the iframe to the body
        document.body.appendChild(iframe);

        // Load the template
        iframe.src = 'pdf-template.html';

        // Wait for the template to load
        iframe.onload = () => {
            // Wait for fonts to load
            document.fonts.ready.then(() => {
                // Use html2canvas to capture the content
                html2canvas(iframe.contentDocument.body, {
                    scale: 2,
                    useCORS: true,
                    logging: true,
                    windowWidth: 1200,
                    windowHeight: 1600,
                    backgroundColor: '#ffffff',
                    letterRendering: true
                }).then(canvas => {
                    // Create PDF using jsPDF
                    const imgData = canvas.toDataURL('image/jpeg', 1.0);
                    const pdf = new jsPDF({
                        unit: 'pt',
                        format: 'a4',
                        orientation: 'portrait'
                    });

                    const imgProps = pdf.getImageProperties(imgData);
                    const pdfWidth = pdf.internal.pageSize.getWidth();
                    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

                    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
                    pdf.save('PranavJagadish_Resume.pdf');

                    // Cleanup
                    document.body.removeChild(iframe);
                }).catch(err => {
                    console.error('Error generating PDF:', err);
                    document.body.removeChild(iframe);
                    alert('Error generating PDF. Please try again.');
                });
            });
        };

    } catch (error) {
        console.error('Unexpected error:', error);
        alert('An unexpected error occurred. Please try again.');
    }
}