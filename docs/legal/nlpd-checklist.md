# Checklist nLPD — EnCave (pré-lancement)

> Loi fédérale sur la protection des données (nLPD, en vigueur 09.2023).
> La **signature de cette checklist est un acte de Sam** (responsable du
> traitement) — P-16 / L-186. Statut au 2026-07-16.

## 1. Registre des traitements

| Traitement | Données | Base | Durée | Sous-traitants | Statut |
| --- | --- | --- | --- | --- | --- |
| Comptes utilisateurs | nom, e-mail, tél, locale, mot de passe (bcrypt) | exécution du contrat | vie du compte + anonymisation sur demande | Neon, Vercel | ✅ en place |
| Réservations | identité visiteur, e-mail, tél, contenu réservation | contrat | 10 ans (compta) | Neon, Stripe, Resend | ✅ |
| Paiements | aucune donnée carte chez nous (Stripe) ; ids Stripe + montants | contrat / obligation légale | 10 ans | Stripe | ✅ |
| Empreinte no-show | customer + payment method Stripe, consentement horodaté (`noShowPolicyAcceptedAt`, version, montant) | consentement explicite | jusqu'à exécution/annulation | Stripe | ✅ (P-08) |
| Bons cadeaux | acheteur, bénéficiaire (nom, e-mail), message | contrat | 5 ans + compta | Neon, Resend | ✅ (P-09) |
| Sur-mesure | demandeur (nom, e-mail, tél), contenu demande | mesures précontractuelles | 2 ans | Neon, Resend | ✅ (P-10) |
| Événements collectifs — roster | nom + e-mail des participants, exposés au domaine organisateur | contrat ; information dans les CGV (§ Événements collectifs) | durée de l'événement + compta | Neon | ✅ CGV P-16 (dette P-11 soldée) |
| E-mails transactionnels + open/click | e-mail, événements d'ouverture/clic par cave | intérêt légitime ; désinscription | 2 ans | Resend | ⚠️ 3 e-mails agrégés sans lien de désinscription tokenisé (dette connue CLAUDE.md) |
| Mesure d'audience | événements produit (PostHog EU), Web Vitals | consentement (bannière cookies) | 12 mois | PostHog | ✅ |
| Erreurs & logs | données techniques, ids | intérêt légitime | 90 jours | Sentry, Vercel (Pino) | ✅ |
| Rate limiting | IP (courte durée) | intérêt légitime (sécurité) | fenêtres minutes | Upstash | ✅ |

## 2. Droits des personnes

- [x] Export des données : `/api/privacy/export` + espace Compte.
- [x] Suppression / anonymisation : `requestAccountDeletion` branché
      (`DeleteAccountSection`) ; anonymisation admin (`anonymizeUserAsAdmin`).
- [x] Rectification : édition du profil.
- [x] Information : politique de confidentialité à jour (sous-traitants
      complets P-16, renvoi export/suppression).

## 3. Actes restants (Sam) — bloquants avant bascule

- [ ] **Mentions légales** : compléter raison sociale / forme / adresse /
      IDE (placeholders `[À COMPLÉTER]`, bloqué sur le choix d'entité).
- [ ] **DPA sous-traitants** : signer/archiver les DPA Vercel, Neon,
      Stripe, Resend, PostHog, Sentry, Upstash (tous proposent un DPA
      standard en ligne).
- [ ] **Validation juridique des CGV** (nouvelles sections P-16 : bons,
      no-show, sur-mesure, annulation par cave, booking fee, roster
      événements).
- [ ] **Désinscription tokenisée** des 3 e-mails agrégés (producteur du
      lien `/api/unsubscribe/[token]`) — dette technique à planifier.
- [ ] Signature de cette checklist (date + nom) : ______________________

## 4. Violations de données

Procédure : détection (Sentry / health) → évaluation du risque pour les
personnes → si risque élevé, annonce au PFPDT « dans les meilleurs délais »
(art. 24 nLPD) + information des personnes concernées si nécessaire →
post-mortem. Contact PFPDT : https://www.edoeb.admin.ch.
