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