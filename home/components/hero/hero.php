<?php
// CLB-Tools/home/components/hero/hero.php
?>
<section class="hero-section" id="hero">
    <div class="container hero-grid">
        <!-- Texte Principal Stylisé -->
        <div class="hero-text">
            <h1 class="hero-title">SUITE DE PRODUCTION <span>GRAPHIQUE & IMPRESSION</span></h1>
            <p class="hero-subtitle">Gérez vos codes, composez vos étiquettes et préparez vos impositions PDF en quelques clics. Une solution PWA légère et performante.</p>
            <div class="hero-btns">
                <a href="#tools" class="btn btn-primary">Démarrer un projet <i class="fas fa-rocket"></i></a>
                <a href="#workflow" class="btn btn-outline">Voir la Démo</a>
            </div>
        </div>

        <!-- Slider avec Cadre Décoratif -->
        <div class="hero-visual">
            <div class="slider-frame"> <!-- Cadre décoratif -->
                <div class="slider-container">
                    <div class="slider-wrapper" id="hero-slider">
                        <!-- Slide 01 -->
                        <div class="slide active">
                            <img src="../../../Images/home.png" alt="Interface Accueil">
                            <div class="slide-caption">
                                <h3>Tableau de bord</h3>
                                <p>Visualisez l'ensemble de vos outils CLB en un coup d'œil.</p>
                            </div>
                        </div>
                        <!-- Slide 02 -->
                        <div class="slide">
                            <img src="../../../Images/codegenerator.png" alt="Générateur de Code">
                            <div class="slide-caption">
                                <h3>Générateur de Codes</h3>
                                <p>Créez vos codes-barres et QR codes instantanément.</p>
                            </div>
                        </div>
                        <!-- Slide 03 -->
                        <div class="slide">
                            <img src="../../../Images/labelgenerator.png" alt="Composition Étiquettes">
                            <div class="slide-caption">
                                <h3>Étiqueteuse Intelligente</h3>
                                <p>Concevez des designs conformes aux normes industrielles.</p>
                            </div>
                        </div>
                        <!-- Slide 04 -->
                        <div class="slide">
                            <img src="../../../Images/zimager.png" alt="Imposition PDF">
                            <div class="slide-caption">
                                <h3>Imposition PDF</h3>
                                <p>Préparez vos fichiers pour l'impression grand format.</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Commandes du Slider -->
                <div class="slider-nav">
                    <div class="slider-dots">
                        <span class="dot active" data-index="0"></span>
                        <span class="dot" data-index="1"></span>
                        <span class="dot" data-index="2"></span>
                        <span class="dot" data-index="3"></span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</section>