/**
 * CLB-Tools - Footer Interactivity & Dynamics
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Mise à jour automatique de l'année
    const yearSpan = document.getElementById('current-year');
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }

    // 2. Fonctionnalité Retour en haut de page
    const scrollTopBtn = document.getElementById('scroll-top-btn');
    
    if (scrollTopBtn) {
        window.addEventListener('scroll', () => {
            // Affiche le bouton après 500px de scroll
            if (window.scrollY > 500) {
                scrollTopBtn.style.opacity = '1';
                scrollTopBtn.style.visibility = 'visible';
                scrollTopBtn.style.transform = 'translateY(0)';
            } else {
                scrollTopBtn.style.opacity = '0';
                scrollTopBtn.style.visibility = 'hidden';
                scrollTopBtn.style.transform = 'translateY(20px)';
            }
        });

        scrollTopBtn.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth' // Scroll fluide
            });
        });
    }

    // 3. Animation d'apparition des liens au survol
    const footerLinks = document.querySelectorAll('.footer-links li a');
    footerLinks.forEach(link => {
        link.addEventListener('mouseenter', () => {
            link.style.letterSpacing = '1px';
        });
        link.addEventListener('mouseleave', () => {
            link.style.letterSpacing = 'normal';
        });
    });
});