CLB-Tools/
├─ accueil.index.css                     # Feuille de style principale pour la page d'accueil ; contient les règles globales du thème et les variables CSS.
├─ desc.md                               # Description du projet en Markdown ; documentation lisible par l'équipe ou affichée dans l'UI.
├─ index.php                             # Page d'accueil / point d'entrée public qui assemble les composants front-end.
├─ manifest.php                           # Générateur/serveur du manifest PWA côté serveur ; peut retourner du JSON dynamique.
├─ pwa-config.php                        # Configuration serveur pour la PWA (stratégies de cache, enregistrement du service worker).
├─ struct.md                              # Ce fichier : arbre du projet (format similaire à `tree /f`) avec commentaires explicatifs.
├─ sw.js                                  # Service worker principal ; gère la mise en cache et les stratégies offline.
├─ admin/                                 # Interface d'administration du gestionnaire de bibliothèque (UI + outils admin).
│  ├─ index.php                           # Entrée de l'interface admin ; panneau de contrôle pour administrateurs.
│  ├─ script.js                           # Logique JS côté client pour opérations admin (upload, suppression, filtrage).
│  ├─ style.css                           # Styles CSS spécifiques à l'admin.
│  └─ apps/                               # Dossier applicatif pour modules/mini-apps de l'admin.
│     └─ components/                     # Composants réutilisables (modals, formulaires, boutons).
├─ api/                                   # Endpoints PHP exposant la logique métier (CRUD, thumbnails, uploads).
│  ├─ config.php                          # Paramètres de configuration (chemins, DB, constantes partagées).
│  ├─ lib.php                             # Fonctions utilitaires (manipulation fichiers, validation, génération de miniatures).
│  ├─ list.php                            # Retourne la liste des éléments (supporte pagination/tri/filtre).
│  ├─ get.php                             # Retourne le détail d'une ressource ou exécute une recherche.
│  ├─ upload.php                          # Traitement des uploads : validation MIME, déplacement, création de vignettes, réponse JSON.
│  ├─ delete.php                          # Supprime une ressource (BDD + fichier), avec vérification des autorisations.
│  └─ thumb.php                           # Génération/livraison de miniatures ; mise en cache et redimensionnement à la volée.
├─ assets/                                # Ressources et scripts d'initialisation liés à la bibliothèque et à la PWA.
│  ├─ init_library.ps1                    # Script PowerShell d'initialisation (création dossiers, permissions Windows, import initial).
│  ├─ library/                            # Contenu de la bibliothèque locale : métadonnées, vignettes, uploads.
│  │  ├─ manifest.json                    # Manifest local ou export des métadonnées de la bibliothèque.
│  │  ├─ metadata.json                    # Schéma et données d'exemple pour la bibliothèque.
│  │  ├─ thumbs/                          # Vignettes générées pour les éléments de la bibliothèque.
│  │  └─ uploads/                         # Emplacement des fichiers uploadés (images, documents) par les utilisateurs.
│  └─ pwa/                                # Manifest statique pour la PWA (icônes, nom, start_url, display).
│     └─ manifest.json                    # Manifest statique pour la PWA (icônes, nom, start_url, display).
├─ pwa/                                   # Manifest client pour la Progressive Web App (peut être identique à assets/pwa/manifest.json).
│  └─ manifest.json                       # Manifest client pour la Progressive Web App.
├─ authform/                              # Mini-app formulaire d'authentification (client-side simple).
│  ├─ index.php                           # Page du formulaire (login/signup).
│  ├─ script.js                           # Validations du formulaire et requêtes AJAX vers l'API d'auth.
│  └─ style.css                           # Styles du formulaire.
├─ codegenerator/                         # Outils front pour générer du code ou des snippets.
│  ├─ index.html                          # UI du générateur.
│  ├─ script.js                           # Logique de génération, aperçu et export.
│  └─ style.css                           # Styles dédiés.
├─ home/                                  # Section publique « home » avec composants modulaires.
│  ├─ index.php                           # Page d'accueil et de présentation de CLB-Tools.
│  ├─ script.js                           # Script client principal pour la section home.
│  ├─ style.css                           # Styles globaux pour la section home.
│  └─ components/                         # Composants réutilisables présents sur la page d'accueil.
│     ├─ cards/                           # Composant d'affichage en cartes (visuel, comportement, responsivité).
│     │  ├─ cards.css                     # Styles pour le composant de cartes.
│     │  ├─ cards.js                      # Comportement JS du composant cards.
│     │  └─ cards.php                     # Template PHP qui rend les cartes.
│     ├─ contact/                         # Composant contact (formulaire, styles, JS).
│     │  ├─ contact.css                   # Styles du composant contact.
│     │  ├─ contact.js                    # Logique JS du composant contact.
│     │  └─ contact.php                   # Template d'affichage du formulaire/contact.
│     ├─ cta/                              # Call To Action.
│     │  ├─ cta.css                       # Styles CTA (Call To Action).
│     │  ├─ cta.js                        # Comportement CTA.
│     │  └─ cta.php                       # Template PHP du CTA.
│     ├─ demo/                             # Composant de démonstration/exemple.
│     │  ├─ demo.css                      # Styles du composant démo.
│     │  ├─ demo.js                       # Scripts interactifs pour la démo.
│     │  └─ demo.php                      # Template pour l'exemple/démo.
│     ├─ features/                         # Présentation des fonctionnalités.
│     │  ├─ features.css                  # Styles pour la section fonctionnalités.
│     │  ├─ features.js                   # JS spécifique aux features.
│     │  └─ features.php                  # Template PHP pour lister les fonctionnalités.
│     ├─ footer/                          # Bas de page réutilisable.
│     │  ├─ footer.css                    # Styles du bas de page.
│     │  ├─ footer.js                     # Comportements du footer.
│     │  └─ footer.php                    # Template réutilisable du footer.
│     ├─ hero/                             # Bandeau principal / hero section.
│     │  ├─ hero.css                      # Styles pour la section hero/bandeau.
│     │  ├─ hero.js                       # Animation ou comportements du hero.
│     │  └─ hero.php                      # Template du hero.
│     ├─ library/                          # Composants d'affichage de la bibliothèque (grilles, filtres).
│     │  ├─ library.css                   # Styles pour l'affichage de la bibliothèque (grille, cards).
│     │  ├─ library.js                    # Scripts pour filtrage, pagination client-side.
│     │  └─ library.php                   # Template / composant d'affichage de la bibliothèque.
│     ├─ navbar/                           # Barre de navigation principale.
│     │  ├─ navbar.css                    # Styles pour la barre de navigation.
│     │  ├─ navbar.js                     # Comportement mobile / toggles.
│     │  └─ navbar.php                    # Template de la navbar.
│     └─ workflow/                         # Composant illustrant un flux ou étapes.
│        ├─ workflow.css                  # Styles pour l'illustration du workflow.
│        ├─ workflow.js                   # Scripts pour interactions du workflow.
│        └─ workflow.php                  # Template PHP du composant workflow.
├─ links/                                 # Fichiers d'inclusion de liens/scripts/styles réutilisables.
│  ├─ scriptLink.php                      # Génère les balises `<script>` partagées.
│  └─ styleLink.php                       # Génère les balises `<link>` pour les feuilles de style.
├─ Images/                                # Répertoire contenant des images statiques (icônes, exemples). Structure interne variable.
├─ labelgenerator/                        # Générateur d'étiquettes/labels côté client.
│  ├─ index.html                          # Interface utilisateur du label generator.
│  ├─ script.js                           # Logique de création et export des labels.
│  └─ style.css                           # Styles associés.
├─ scripts/                               # Scripts utilitaires.
│  └─ imageservice.js                     # Script utilitaire JS pour la gestion d'images (chargement, transformation, lazyload).
└─ zimager/                               # Outil/mini-app lié au traitement d'images.
   ├─ index.html                           # Interface utilisateur de l'outil zimager.
   ├─ script.js                            # Logique front pour opérations d'édition/traitement d'image.
   └─ style.css                            # Styles de l'outil.