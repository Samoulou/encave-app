# UAT-EMAIL-CHECKLIST — Les 22 emails transactionnels

> Référentiel : `docs/v3/ENCAVE-V3-PAGES-EMAILS.md` §8. Fonctions vérifiées
> dans `src/server/services/email.service.ts`. Méthode **triple source** dans
> l'ordre : boîte Gmail → dashboard Resend → table `email_logs` (SQL Q6,
> UAT-CAMPAIGN §7).
>
> **Statut** : `OK` (3 sources concordantes) · `KO` (→ ouvrir un défaut) ·
> `N/T` (non testable sur staging — justifier).

## Checklist générique (à appliquer à CHAQUE email avant de cocher OK)

- [ ] **Destinataire** correct (client = `visitorEmail` ; cave = email du
      domaine ; admin = adresse admin).
- [ ] **Locale** : email client dans `Booking.locale` (jamais la langue de
      l'encaveur) ; testé croisé en S13-D/S14.
- [ ] **Montants au centime**, décomposition fee/bon quand pertinente.
- [ ] **Dates/heures Europe/Zurich**, format localisé.
- [ ] **Liens tokenisés** ouvrent **sans login** (navigation privée) : billet,
      offre, page commande.
- [ ] **Pièces jointes** présentes et lisibles (PDF billet, .ics, PDF bon).
- [ ] **Idempotence** : re-déclenchement (re-cron, redelivery webhook) → pas
      de doublon.
- [ ] **Unsubscribe** : lien présent et fonctionnel (voir dette S13-C pour
      les agrégats).
- [ ] Pas en spam ; rendu propre mobile + desktop (spot-check).

## Les 22 emails

| #   | Email                                | Déclencheur                                           | Fonction (code)                     | Session | Statut | Notes                                                              |
| --- | ------------------------------------ | ----------------------------------------------------- | ----------------------------------- | ------- | ------ | ------------------------------------------------------------------ |
| 1   | Confirmation + billet (client)       | Paiement validé (webhook checkout)                    | `sendBookingConfirmationEmail`      | S1      |        | QR + lien billet tokenisé + PDF + .ics — vérif n°1 de la campagne  |
| 2   | Rappel J-1 (client)                  | Cron `reminders` — garde 18 h Zurich                  | `sendBookingReminderEmail`          | S13     |        | `email_logs.type='reminder_24h'` ; hors 18 h Zurich = skip normal  |
| 3   | Vos coups de cœur J+2 (client)       | Job `TASTING_RECAP` (fiche remplie)                   | `sendTastingRecapEmail`             | S10     |        | Vins + prix + CTA commande tokenisé ; opt-out tokenisé fonctionnel |
| 4   | Annulation confirmée (client)        | Client annule                                         | `sendBookingCancellationEmail`      | S4, S8  |        | Triangle au centime UI = Stripe = email ; décomposition carte/bon  |
| 5   | Annulation par la cave (client)      | Encaveur annule                                       | `sendBookingCancelledByWineryEmail` | S4      |        | Remboursement intégral automatique                                 |
| 6   | Reçu bon cadeau (acheteur)           | Achat bon payé                                        | `sendGiftCardPurchaseEmail`         | S8      |        | Rappel de la date d'envoi choisie                                  |
| 7   | Votre bon cadeau (bénéficiaire)      | Job `GIFT_CARD_DELIVERY` (date choisie)               | `sendGiftCardDeliveryEmail`         | S8      |        | Code + message personnel + CTA ; re-drain → pas de doublon         |
| 8   | Demande envoyée (client)             | Request créée                                         | `sendRequestSubmittedEmail`         | S9      |        | Délai 48 h annoncé                                                 |
| 9   | Offre reçue (client)                 | Encaveur envoie l'offre                               | `sendRequestOfferReceivedEmail`     | S9      |        | Échéance + lien paiement tokenisé (`/fr/sur-mesure/offre/{token}`) |
| 10  | Offre bientôt expirée (client)       | Job `REQUEST_OFFER_REMINDER` (24 h avant échéance)    | `sendRequestOfferExpiringEmail`     | S9      |        | Relance **unique** ; même lien que #9                              |
| 11  | Code de connexion (OTP)              | « Recevoir un code »                                  | `sendOtpEmail`                      | S2      |        | 6 chiffres lisibles, expiration annoncée                           |
| 12  | Vos billets — lien magique (invité)  | Achat invité                                          | — **pas de template distinct**      | S1      |        | Écart §11.2 : couvert par le lien tokenisé du **#1**               |
| 13  | Frais de no-show prélevés (client)   | Encaveur déclenche le prélèvement                     | `sendNoShowFeeChargedEmail`         | S7      |        | Montant + politique acceptée **horodatée**                         |
| 14  | Nouvelle réservation (cave)          | Booking confirmé                                      | `sendWinemakerNewBookingEmail`      | S1      |        | Cave seed `@example.com` → conclure via Resend + email_logs        |
| 15  | Nouvelle demande sur-mesure (cave)   | Request reçue                                         | `sendRequestNewCustomEmail`         | S9      |        | CTA répondre + rappel SLA 48 h                                     |
| 16  | Annulation client (cave)             | Client annule                                         | `sendWinemakerCancellationEmail`    | S4      |        | Créneau libéré                                                     |
| 17  | Virement envoyé + récap hebdo (cave) | Cron `weekly-summary` (lundi)                         | `sendWeeklySummaryEmail`            | S13     |        | `email_logs.type='weekly_summary'` ; dette unsubscribe (S13-C)     |
| 18  | Action requise Stripe (cave)         | Webhook connect `account.updated`                     | `sendStripeActionRequiredEmail`     | S5      |        | Anti-spam : hash `currently_due` + cooldown **7 j** (écart plan)   |
| 19  | Domaine validé — bienvenue (cave)    | Admin valide                                          | `sendWineryApprovedEmail`           | S5      |        | CTA onboarding                                                     |
| 20  | Domaine refusé (cave)                | Admin refuse                                          | `sendWineryRejectedEmail`           | S5      |        | Motif + voie de recours                                            |
| 21  | Fiche dégustation à remplir (cave)   | Cron `tasting-sheet-reminder` 21 h Zurich, fiche vide | `sendTastingSheetReminderEmail`     | S10     |        | 1/cave/jour ; hors 21 h Zurich = skip normal                       |
| 22  | Nouveau domaine à valider (admin)    | Signup encaveur self-service                          | `sendAdminNewWineryToValidateEmail` | S5      |        | CTA valider                                                        |

## Emails hors numérotation (existants dans le code — vérifier au passage, pas de gate)

| Email                           | Fonction (code)                                                                                                                      | Déclencheur / session                          | Statut |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- | ------ |
| Rappel 2 h (client)             | `sendClientReminder2hEmail`                                                                                                          | Cron `reminders` (à chaque run) — S13          |        |
| Hold/booking expiré (client)    | `sendBookingExpiredEmail`                                                                                                            | Cron `expire-pending-bookings` — S1-E          |        |
| Digest quotidien (cave)         | `sendDailyDigestEmail`                                                                                                               | Cron `daily-digest` — S13 (dette unsubscribe)  |        |
| Follow-up J+1 (client)          | `sendPostExperienceFollowUpEmail`                                                                                                    | Cron `follow-ups` — S10-D (skip si recap armé) |        |
| Refund manuel (client / cave)   | `sendManualRefundClientEmail` / `sendManualRefundWinemakerEmail`                                                                     | Admin refund — S12-B                           |        |
| Demande de commande vins (cave) | `sendWineOrderRequestEmails`                                                                                                         | CTA page commande — S10-C                      |        |
| Escalade SLA request            | `sendRequestSlaEscalationEmail`                                                                                                      | Job `REQUEST_SLA_ESCALATION` — S9-E            |        |
| Cycle de vie compte             | `sendWelcomeEmail`, `sendEmailVerificationEmail`, `sendEmailChangedNoticeEmail`, `sendAccountDeletedEmail`, `sendPasswordResetEmail` | Inscription / profil / suppression — S2/S12    |        |
| Message de contact              | `sendContactMessageEmail`                                                                                                            | `/fr/contact`                                  |        |

## Relevé de fin de session S13

```
Emails OK : ____ / 22 · KO : ____ · N/T : ____
Défauts ouverts : ______________________________________
Décision dette unsubscribe agrégats (S13-C) : ______________________________________
```
