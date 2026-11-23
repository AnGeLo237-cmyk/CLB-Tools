/**
 * CLB-Tools - Demo Video Control & Animations
 */

document.addEventListener('DOMContentLoaded', () => {
    const video = document.getElementById('clb-video');
    const overlay = document.getElementById('video-overlay');
    const featCards = document.querySelectorAll('.demo-feat-card');

    /**
     * Gestion du lancement de la vidéo
     */
    overlay.addEventListener('click', () => {
        overlay.style.opacity = '0';
        overlay.style.pointerEvents = 'none';
        video.play();
        video.controls = true; // Affiche les contrôles natifs après le premier clic
    });

    /**
     * Pause automatique si l'utilisateur quitte la section
     */
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting && !video.paused) {
                video.pause();
            }
        });
    }, { threshold: 0.2 });

    observer.observe(video);

    /**
     * Animation des cartes au survol de la vidéo (Focus visuel)
     */
    video.addEventListener('play', () => {
        document.querySelector('.video-frame').style.borderColor = 'var(--color-primary)';
    });

    video.addEventListener('pause', () => {
        document.querySelector('.video-frame').style.borderColor = 'var(--color-gray)';
    });

    // Effet d'apparition séquentielle des cartes au scroll
    const cardObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                setTimeout(() => {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }, index * 200);
            }
        });
    }, { threshold: 0.5 });

    featCards.forEach(card => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(30px)';
        card.style.transition = 'all 0.6s ease-out';
        cardObserver.observe(card);
    });
});