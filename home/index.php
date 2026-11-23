<?php
 // CLB-Tools/home/index.php : Page de présentation assemblant les composants front-end.
?>
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Accueil - CLB-Tools</title>
    
    <?php
        // Inclusion des liens des fichiers de style pour les différents composants
        include 'links/styleLink.php';
    ?>

    <link rel="manifest" href="../manifest.php">    
</head>
<body>

    <?php 
    // Assemblage des composants modulaires définis dans home/components/
    
    // 1. Barre de navigation
    include 'components/navbar/navbar.php'; 
    ?>

    <main>
        <?php 
        // 2. Section Hero (Présentation principale)
        include 'components/hero/hero.php'; 
        
        // 3. Section Features / Cards (Accès aux outils : Code, Label, Zimager)
        include 'components/features/features.php'; 
        
        // 4. Section Workflow (Illustration du flux de production)
        include 'components/workflow/workflow.php';
        
        // 5. Section Cards (Présentation détaillée des modules de l'outil CLB-Tools)
        include 'components/cards/cards.php';
        
        // 6. Section Library (Présentation de la bibliothèque de ressources)
        include 'components/library/library.php';
        
        // 7. Section Demo (Démonstration interactive de l'outil)
        include 'components/demo/demo.php';

        // 8. Section Prices (Présentation des tarifs et options d'abonnement)
        include 'components/prices/prices.php';
        
        // 9. Section CTA (Appel à l'action pour inciter les utilisateurs à essayer l'outil)
        include 'components/cta/cta.php';
        
        // 10. Section Contact (Formulaire de contact pour les demandes d'information ou de support)
        include 'components/contact/contact.php';        
        ?>
    </main>

    <?php 
    // 11. Pied de page
    include 'components/footer/footer.php'; 
    ?>

    <?php
        // Inclusion des liens des scripts correspondants à un composant pour l'interactivité et les fonctionnalités dynamiques
        include 'links/scriptLink.php';
    ?>

    <script>
        // Enregistrement du Service Worker pour le mode PWA
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('../sw.js');
        }
    </script>
</body>
</html>