// Prioritize LCP elements
document.addEventListener('DOMContentLoaded', function() {
    // Set highest priority for hero section
    const hero = document.querySelector('.hero');
    if (hero) {
        hero.style.contentVisibility = 'auto';
        hero.style.containIntrinsicSize = '100vh';
    }

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
});

// Hamburger Menu Functionality
const hamburger = document.querySelector('.hamburger-menu');
const sideNav = document.querySelector('.side-nav');
const overlay = document.querySelector('.overlay');

hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    sideNav.classList.toggle('active');
    overlay.classList.toggle('active');
    document.body.style.overflow = sideNav.classList.contains('active') ? 'hidden' : '';
});

overlay.addEventListener('click', () => {
    hamburger.classList.remove('active');
    sideNav.classList.remove('active');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
});

// Close menu when clicking a link
document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', () => {
        hamburger.classList.remove('active');
        sideNav.classList.remove('active');
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    });
});

// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        document.querySelector(this.getAttribute('href')).scrollIntoView({
            behavior: 'smooth'
        });
    });
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

document.addEventListener('DOMContentLoaded', function() {
    const hamburger = document.querySelector('.hamburger-menu');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.overlay');
    const navLinks = document.querySelectorAll('.sidebar-nav-item');

    // Toggle sidebar
    hamburger.addEventListener('click', function() {
        sidebar.classList.toggle('active');
        overlay.classList.toggle('active');
        hamburger.classList.toggle('active');
    });

    // Close sidebar when clicking overlay
    overlay.addEventListener('click', function() {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
        hamburger.classList.remove('active');
    });

    // Close sidebar when clicking a link
    navLinks.forEach(link => {
        link.addEventListener('click', function() {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
            hamburger.classList.remove('active');
        });
    });

    // Set active link based on current section
    function setActiveLink() {
        const sections = document.querySelectorAll('section');
        const scrollPosition = window.scrollY;

        sections.forEach(section => {
            const sectionTop = section.offsetTop - 100;
            const sectionBottom = sectionTop + section.offsetHeight;
            const sectionId = section.getAttribute('id');

            if (scrollPosition >= sectionTop && scrollPosition < sectionBottom) {
                navLinks.forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href') === `#${sectionId}`) {
                        link.classList.add('active');
                    }
                });
            }
        });
    }

    // Update active link on scroll
    window.addEventListener('scroll', setActiveLink);
    setActiveLink(); // Set initial active link
});