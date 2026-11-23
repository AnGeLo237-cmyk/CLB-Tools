/**
 * CLB-Tools - Library Mosaic Logic
 */

document.addEventListener('DOMContentLoaded', () => {
    const mosaicContainer = document.getElementById('library-mosaic');
    const filterButtons = document.querySelectorAll('.filter-btn');

    // Simulation de 20 ressources (Données mockées)
    const assets = [
        { id: 1, type: 'code', title: 'Barcode EAN-13', size: 'large' },
        { id: 2, type: 'label', title: 'Étiquette Logistique', size: 'small' },
        { id: 3, type: 'image', title: 'Template A4', size: 'tall' },
        { id: 4, type: 'code', title: 'QR Code v3', size: 'small' },
        { id: 5, type: 'label', title: 'Badge Visiteur', size: 'wide' },
        { id: 6, type: 'image', title: 'Mockup Produit', size: 'small' },
        { id: 7, type: 'code', title: 'Datamatrix', size: 'small' },
        { id: 8, type: 'label', title: 'Étiquette Prix', size: 'tall' },
        { id: 9, type: 'image', title: 'Fond de Sécurité', size: 'large' },
        { id: 10, type: 'code', title: 'Code 128', size: 'small' },
        { id: 11, type: 'label', title: 'Sticker Rond', size: 'small' },
        { id: 12, type: 'image', title: 'Icon Set', size: 'wide' },
        { id: 13, type: 'code', title: 'Aztec Code', size: 'small' },
        { id: 14, type: 'label', title: 'Label Expédition', size: 'small' },
        { id: 15, type: 'image', title: 'Bannière Web', size: 'tall' },
        { id: 16, type: 'code', title: 'PDF417', size: 'small' },
        { id: 17, type: 'label', title: 'Étiquette Vin', size: 'small' },
        { id: 18, type: 'image', title: 'Texture Papier', size: 'large' },
        { id: 19, type: 'code', title: 'ITF-14', size: 'wide' },
        { id: 20, type: 'label', title: 'Tag Inventaire', size: 'small' }
    ];

    /**
     * Rendu de la mosaïque selon le filtre
     */
    function renderMosaic(filter = 'all') {
        mosaicContainer.innerHTML = ''; // Vide la grille
        
        const filteredAssets = filter === 'all' 
            ? assets 
            : assets.filter(asset => asset.type === filter);

        filteredAssets.forEach(asset => {
            const card = document.createElement('div');
            card.className = `asset-card ${asset.size}`;
            
            // Note : Remplacez par vos vrais chemins d'images (ex: Images/lib-1.png)
            card.innerHTML = `
                <img src="https://picsum.photos/seed/${asset.id + 50}/600/600" alt="${asset.title}">
                <div class="asset-overlay">
                    <span>#${asset.type}</span>
                    <h4>${asset.title}</h4>
                </div>
            `;
            mosaicContainer.appendChild(card);
        });
    }

    // Gestion du clic sur les filtres
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // UI : Bouton actif
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Logique de filtrage avec animation
            mosaicContainer.style.opacity = '0';
            setTimeout(() => {
                renderMosaic(btn.getAttribute('data-filter'));
                mosaicContainer.style.opacity = '1';
            }, 300);
        });
    });

    // Initialisation
    renderMosaic();
});