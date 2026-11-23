<?php
    // Inclusion des liens des scripts des différents composants
    echo '<script src="../script.js" defer></script>';
    echo '<script src="components/navbar/navbar.js" defer></script>';
    echo '<script src="components/hero/hero.js" defer></script>';
    echo '<script src="components/features/features.js" defer></script>';
    echo '<script src="components/workflow/workflow.js" defer></script>';
    echo '<script src="components/footer/footer.js" defer></script>';
    echo '<script src="components/cards/cards.js" defer></script>';
    echo '<script src="components/library/library.js" defer></script>';
    echo '<script src="components/demo/demo.js" defer></script>';
    echo '<script src="components/prices/prices.js" defer></script>';
    echo '<script src="components/cta/cta.js" defer></script>';
    echo '<script src="components/contact/contact.js" defer></script>';
    // Inclusion du Servicve Worker pour le mode PWA
    echo '<script src="../sw.js"></script>';
    // Inclusion de la configuration PWA pour que les scripts front-end puissent construire des URLs correctes
    echo '<script src="../pwa-config.php"></script>';
?>