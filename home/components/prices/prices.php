<?php
// CLB-Tools/home/components/prices/prices.php
?>
<section class="prices-section" id="prices">
    <div class="container">
        <div class="section-header">
            <h2>Plans & Tarifs</h2>
            <p>Une structure tarifaire évolutive pour accompagner chaque étape de votre production.</p>
        </div>

        <div class="prices-grid">
            
            <!-- 1. Offre GRATUITE -->
            <div class="price-card">
                <div class="price-card-header">
                    <h3>Découverte</h3>
                    <div class="price-value">0€<span>/mois</span></div>
                    <p class="price-subtitle">Pour tester les outils de base.</p>
                </div>
                <ul class="price-features">
                    <li><i class="fas fa-check"></i> CodeGenerator (Standard)</li>
                    <li><i class="fas fa-check"></i> LabelGenerator (3/jour)</li>
                    <li class="disabled"><i class="fas fa-times"></i> Export PDF HD</li>
                    <li class="disabled"><i class="fas fa-times"></i> Zimager Imposition</li>
                </ul>
                <div class="price-footer">
                    <a href="#" class="btn btn-outline">S'inscrire</a>
                </div>
            </div>

            <!-- 2. Offre PAYANTE NIVEAU 1 -->
            <div class="price-card">
                <div class="price-card-header">
                    <h3>Start</h3>
                    <div class="price-value" data-monthly="15" data-yearly="12">15€<span>/mois</span></div>
                    <p class="price-subtitle">Pour les projets ponctuels.</p>
                </div>
                <ul class="price-features">
                    <li><i class="fas fa-check"></i> Tous les modules</li>
                    <li><i class="fas fa-check"></i> Export PDF haute définition</li>
                    <li><i class="fas fa-check"></i> Support par ticket</li>
                    <li class="disabled"><i class="fas fa-times"></i> API Access</li>
                </ul>
                <div class="price-footer">
                    <a href="#" class="btn btn-outline">Choisir Start</a>
                </div>
            </div>

            <!-- 3. Offre PAYANTE NIVEAU 2 (Featured) -->
            <div class="price-card featured">
                <div class="price-card-header">
                    <div class="popular-tag">Le plus choisi</div>
                    <h3>Pro</h3>
                    <div class="price-value" data-monthly="29" data-yearly="24">29€<span>/mois</span></div>
                    <p class="price-subtitle">La solution complète pour pros.</p>
                </div>
                <ul class="price-features">
                    <li><i class="fas fa-check"></i> Utilisation illimitée</li>
                    <li><i class="fas fa-check"></i> Zimager Expert (Imposition)</li>
                    <li><i class="fas fa-check"></i> Bibliothèque d'assets 5Go</li>
                    <li><i class="fas fa-check"></i> Support prioritaire</li>
                </ul>
                <div class="price-footer">
                    <a href="#" class="btn btn-primary">Passer au Pro</a>
                </div>
            </div>

            <!-- 4. Offre PAYANTE NIVEAU 3 -->
            <div class="price-card">
                <div class="price-card-header">
                    <h3>Expert</h3>
                    <div class="price-value" data-monthly="59" data-yearly="49">59€<span>/mois</span></div>
                    <p class="price-subtitle">Pour les studios de création.</p>
                </div>
                <ul class="price-features">
                    <li><i class="fas fa-check"></i> Accès Multi-utilisateurs</li>
                    <li><i class="fas fa-check"></i> Cloud Sync Automatique</li>
                    <li><i class="fas fa-check"></i> Accès aux API CLB</li>
                    <li><i class="fas fa-check"></i> Formation incluse</li>
                </ul>
                <div class="price-footer">
                    <a href="#" class="btn btn-outline">Opter pour Expert</a>
                </div>
            </div>

            <!-- 5. Offre PERSONNALISÉE -->
            <div class="price-card custom-plan">
                <div class="price-card-header">
                    <h3>Sur Mesure</h3>
                    <div class="price-value">Contact</div>
                    <p class="price-subtitle">Solutions industrielles.</p>
                </div>
                <ul class="price-features">
                    <li><i class="fas fa-check"></i> SLA Garanti 99.9%</li>
                    <li><i class="fas fa-check"></i> Marque blanche (White label)</li>
                    <li><i class="fas fa-check"></i> Intégration sur site</li>
                    <li><i class="fas fa-check"></i> Account Manager dédié</li>
                </ul>
                <div class="price-footer">
                    <a href="#contact" class="btn btn-outline">Devis gratuit</a>
                </div>
            </div>

        </div>
    </div>
</section>