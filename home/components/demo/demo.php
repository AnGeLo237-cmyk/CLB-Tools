<?php
// CLB-Tools/home/components/demo/demo.php
?>
<section class="demo-section" id="demo">
    <div class="container">
        <!-- En-tête Haute Visibilité -->
        <div class="demo-header">
            <h2 class="demo-main-title">DÉMONSTRATION <span>EN ACTION</span></h2>
            <p class="demo-subtitle">Observez comment CLB-Tools transforme vos concepts en fichiers prêts pour l'impression en moins de 60 secondes.</p>
        </div>

        <div class="demo-player-container">
            <!-- Cadre Vidéo avec Effet de Glow Or -->
            <div class="video-frame">
                <video id="clb-video" poster="../../../Images/demo.png">
                    <source src="../../../Images/demo.mp4" type="video/mp4">
                    Votre navigateur ne supporte pas la lecture de vidéos.
                </video>
                
                <!-- Overlay de Contrôle Initial -->
                <div class="video-overlay" id="video-overlay">
                    <div class="play-trigger">
                        <i class="fas fa-play"></i>
                    </div>
                    <span>Lancer la présentation</span>
                </div>
            </div>

            <!-- Grille de Fonctionnalités Clés -->
            <div class="demo-features-grid">
                <div class="demo-feat-card" data-step="1">
                    <div class="feat-icon"><i class="fas fa-barcode"></i></div>
                    <div class="feat-content">
                        <h4>Génération Flash</h4>
                        <p>Création instantanée de codes-barres conformes GS1.</p>
                    </div>
                </div>
                <div class="demo-feat-card" data-step="2">
                    <div class="feat-icon"><i class="fas fa-layer-group"></i></div>
                    <div class="feat-content">
                        <h4>Mise en Page</h4>
                        <p>Composition automatique des étiquettes sur planches.</p>
                    </div>
                </div>
                <div class="demo-feat-card" data-step="3">
                    <div class="feat-icon"><i class="fas fa-file-pdf"></i></div>
                    <div class="feat-content">
                        <h4>Export Vectoriel</h4>
                        <p>Sortie PDF haute définition prête pour le CTP.</p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</section>