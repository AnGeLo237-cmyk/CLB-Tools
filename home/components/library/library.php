<?php
// CLB-Tools/home/components/library/library.php
?>
<section class="library-preview-section" id="library">
    <div class="container">
        <div class="section-header">
            <h2>Bibliothèque de Ressources</h2>
            <p>Explorez les 20 derniers assets générés par la communauté CLB-Tools.</p>
        </div>

        <!-- Système de Tri -->
        <div class="library-filters">
            <button class="filter-btn active" data-filter="all">Toutes les ressources</button>
            <button class="filter-btn" data-filter="code">Codes & QR</button>
            <button class="filter-btn" data-filter="label">Étiquettes</button>
            <button class="filter-btn" data-filter="image">Templates</button>
        </div>

        <!-- Cadre de la Mosaïque Scrolable -->
        <div class="library-scroll-frame">
            <div id="library-mosaic" class="asset-mosaic">
                <!-- Les 20 images seront injectées ici par library.js -->
                <div class="mosaic-loader">
                    <i class="fas fa-circle-notch fa-spin"></i>
                    <p>Initialisation de la mosaïque...</p>
                </div>
            </div>
        </div>
<br>
        <div class="library-footer">
            <p>Besoin de plus de ressources ?</p>
            <a href="../admin/library_full.php" class="btn btn-primary">Accéder au catalogue complet</a>
        </div>
    </div>
</section>