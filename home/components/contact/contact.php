<?php
// CLB-Tools/home/components/contact/contact.php
?>
<section class="contact-section" id="contact">
    <div class="container">
        <div class="section-header">
            <h2>Contact & Support</h2>
            <p>Une question sur l'utilisation des outils ou un bug à signaler ? Écrivez-nous directement.</p>
        </div>

        <div class="contact-form-wrapper">
            <form action="#" method="POST" class="contact-form">
                <div class="form-row">
                    <div class="form-group">
                        <label for="contact-name">Nom complet</label>
                        <input type="text" id="contact-name" name="name" placeholder="Ex: Jean Dupont" required>
                    </div>
                    <div class="form-group">
                        <label for="contact-email">Adresse e-mail</label>
                        <input type="email" id="contact-email" name="email" placeholder="Ex: jean.dupont@example.com" required>
                    </div>
                </div>

                <div class="form-group">
                    <label for="contact-subject">Objet</label>
                    <input type="text" id="contact-subject" name="subject" placeholder="Ex: Problème avec l'export PDF" required>
                </div>

                <div class="form-group">
                    <label for="contact-message">Message</label>
                    <textarea id="contact-message" name="message" rows="6" placeholder="Décrivez votre besoin en détail..." required></textarea>
                </div>

                <div class="form-submit">
                    <button type="submit" class="btn btn-primary">Envoyer le message</button>
                </div>
            </form>
        </div>
    </div>
</section>