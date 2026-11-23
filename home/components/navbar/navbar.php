<?php
// CLB-Tools/home/components/navbar/navbar.php
?>
<nav class="main-navbar">
    <div class="container navbar-content">
        <a href="../index.php" class="navbar-logo">
            <img src="../../../Images/logo.png" alt="CLB-Tools Logo" class="logo-img">
            <span class="logo-text">CLB-Tools</span>
        </a>
        
        <ul class="navbar-links">
            <li><a href="#hero">Accueil</a></li>
            <li><a href="#features">Fonctionnalités</a></li>
            <li><a href="#cards">Outils</a></li>
            <li><a href="#library">Bibliothèque</a></li>
            <li><a href="#demo">Demo</a></li>
            <li><a href="#prices">Tarifs</a></li>
            <li><a href="#contact">Contact</a></li>
            <li class="mobile-only-auth"><a href="#login"><i class="fas fa-sign-in-alt"></i>&nbsp;&nbsp;&nbsp;Se Connecter</a></li>
            <li class="mobile-only-auth"><a href="#register"><i class="fas fa-user-plus"></i>&nbsp;&nbsp;&nbsp;S'inscrire</a></li>
        </ul>

        <div id="auth-buttons">
            <a href="#login" class="btn"><i class="fas fa-sign-in-alt"></i> Se Connecter</a>
            <a href="#register" class="btn"><i class="fas fa-user-plus"></i> S'inscrire</a>
        </div>

        <div class="navbar-actions">
            <button id="pwa-install-nav" class="btn-install" title="Installer l'application">
                <i class="fas fa-download"></i>
            </button>
            <button class="menu-toggle" aria-label="Ouvrir le menu">
                <i class="fas fa-bars"></i>
            </button>
        </div>
    </div>
</nav>