/**
 * CLB-Tools - Présentation des tarifs
 * Cible : CLB-Tools/home/components/prices/prices.js
 */

document.addEventListener('DOMContentLoaded', () => {
    const billingCheck = document.getElementById('billing-check');
    const priceAmounts = document.querySelectorAll('.price-amount[data-monthly]');

    if (billingCheck) {
        billingCheck.addEventListener('change', () => {
            priceAmounts.forEach(price => {
                const isYearly = billingCheck.checked;
                const monthlyValue = price.getAttribute('data-monthly');
                const yearlyValue = price.getAttribute('data-yearly');
                
                // Animation de transition de texte
                price.style.opacity = '0';
                
                setTimeout(() => {
                    if (isYearly) {
                        price.innerHTML = `${yearlyValue}€<span>/mois</span>`;
                    } else {
                        price.innerHTML = `${monthlyValue}€<span>/mois</span>`;
                    }
                    price.style.opacity = '1';
                }, 200);
            });
        });
    }

    // Animation d'apparition au scroll (Intersection Observer)
    const cards = document.querySelectorAll('.price-card');
    const observerOptions = { threshold: 0.1 };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = entry.target.classList.contains('featured') 
                    ? 'scale(1.05)' 
                    : 'translateY(0)';
            }
        });
    }, observerOptions);

    cards.forEach(card => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(30px)';
        card.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
        observer.observe(card);
    });
});