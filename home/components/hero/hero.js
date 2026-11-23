/**
 * CLB-Tools - Master Hero Logic
 */

document.addEventListener('DOMContentLoaded', () => {
    const wrapper = document.getElementById('hero-slider');
    const dots = document.querySelectorAll('.dot');
    const slides = document.querySelectorAll('.slide');
    let currentIndex = 0;
    const intervalTime = 6000; // Un peu plus long pour lire les textes

    function goToSlide(index) {
        // Déplacement fluide
        wrapper.style.transform = `translateX(-${index * 100}%)`;
        
        // Mise à jour des classes actives
        slides.forEach(s => s.classList.remove('active'));
        slides[index].classList.add('active');
        
        // Mise à jour des dots
        dots.forEach(d => d.classList.remove('active'));
        dots[index].classList.add('active');
        
        currentIndex = index;
    }

    // Changement automatique
    let slideTimer = setInterval(() => {
        let next = (currentIndex + 1) % slides.length;
        goToSlide(next);
    }, intervalTime);

    // Interaction manuelle
    dots.forEach(dot => {
        dot.addEventListener('click', () => {
            clearInterval(slideTimer);
            const target = parseInt(dot.getAttribute('data-index'));
            goToSlide(target);
            // Relance du timer
            slideTimer = setInterval(() => {
                let next = (currentIndex + 1) % slides.length;
                goToSlide(next);
            }, intervalTime);
        });
    });

    // Effet Parallaxe léger sur le titre au scroll
    window.addEventListener('scroll', () => {
        const title = document.querySelector('.hero-title');
        let offset = window.pageYOffset;
        title.style.transform = `translateY(${offset * 0.15}px)`;
    });
});