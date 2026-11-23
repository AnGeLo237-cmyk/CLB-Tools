/**
 * CLB-Tools - Navbar Interactions
 */

document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.querySelector('.menu-toggle');
    const navbarLinks = document.querySelector('.navbar-links');
    const navItems = document.querySelectorAll('.navbar-links li');
    const navbar = document.querySelector('.main-navbar');

    // 1. Gestion du bouton burger et du menu coulissant
    menuToggle.addEventListener('click', () => {
        navbarLinks.classList.toggle('active');
        
        // Animation du bouton burger (bascule entre icône menu et croix)
        const icon = menuToggle.querySelector('i');
        if (navbarLinks.classList.contains('active')) {
            icon.classList.replace('fa-bars', 'fa-times');
            
            // Animation staccato des options du menu
            navItems.forEach((item, index) => {
                item.style.animation = `slideIn 0.3s ease forwards ${index * 0.1}s`;
            });
        } else {
            icon.classList.replace('fa-times', 'fa-bars');
            navItems.forEach(item => item.style.animation = '');
        }
    });

    // 2. Effet visuel au défilement (Navbar devient plus compacte)
    window.addEventListener('scroll', () => {
        if (window.scrollY > 100) {
            navbar.style.height = '70px';
            navbar.style.backgroundColor = 'rgba(0, 0, 0, 0.95)';
        } else {
            navbar.style.height = '80px';
            navbar.style.backgroundColor = 'var(--color-dark)';
        }
    });

    // 3. Fermeture automatique du menu lors du clic sur une option (Mobile)
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navbarLinks.classList.remove('active');
            menuToggle.querySelector('i').classList.replace('fa-times', 'fa-bars');
        });
    });
});