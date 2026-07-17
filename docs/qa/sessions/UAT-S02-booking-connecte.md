# UAT-S02 — Booking connecté + cas spéciaux

> **Parcours** : 3, 4 · **US** : US-201, US-220 · **Flags** : tous OFF
> (partie C : nécessite `NO_SHOW_FEES` ON — exécutée avec/après S7, voir note)
> **Durée** : ~60 min · **Device** : desktop (émulation mobile ponctuelle)
> **Comptes** : `sam.copp8+client-fr@gmail.com` (créé J0) · invité pour l'étape B

## Objectif

Réservation en compte client : OTP (#11), coordonnées pré-remplies,
rattachement des billets invités au compte (insensible à la casse de
l'email), et checkout ON_SITE (empreinte carte zéro débit + acceptation de la
politique horodatée).

## Prérequis

- [ ] Compte `sam.copp8+client-fr@gmail.com` créé et email vérifié (J0).
- [ ] Flags argent OFF (partie A/B) ; partie C : `NO_SHOW_FEES` ON.
- [ ] Une expérience **ON_SITE** (gratuite ou payable sur place) sur la
      **cave 1** existe pour la partie C — c'est l'EXP-B du Volet D Phase 0 ;
      sinon la créer via `/fr/dashboard/experiences/new` (compte
      `jean-rene@example.com`, mode de paiement « sur place », publier).
- [ ] Cave 1 : `noShowFeeEnabled = true`, `noShowFeeCents = 1500` (état seed).

## Étapes

### A. Connexion OTP + booking pré-rempli (parcours 3)

| #   | Action / attendu                                                                                                                                                                                             | PASS | FAIL |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- | ---- |
| 1   | `https://encave-dev.vercel.app/fr/login` → « Recevoir un code » avec `sam.copp8+client-fr@gmail.com` → email #11 reçu : code 6 chiffres lisible, expiration annoncée                                         | [ ]  | [ ]  |
| 2   | Saisir le code → connecté, retour à la page d'origine                                                                                                                                                        | [ ]  | [ ]  |
| 3   | Réserver une expérience cave 1 (2 pers.) : au checkout, **coordonnées repliées et pré-remplies** (« Vous réservez en tant que… »)                                                                            | [ ]  | [ ]  |
| 4   | Payer `4242…4242` → succès → le booking apparaît dans l'espace client (`/fr/dashboard/my-bookings`), statut confirmé                                                                                         | [ ]  | [ ]  |
| 5   | Email #1 sur `+client-fr` : conforme (fr, montants, lien billet)                                                                                                                                             | [ ]  | [ ]  |
| 6   | **Carte sauvegardée** : constat attendu = AUCUNE case « Enregistrer ma carte » (`setup_future_usage` non implémenté — écart §11.7 du plan maître, dette assumée). Si une case apparaît : tester et consigner | [ ]  | [ ]  |

### B. Rattachement post-paiement, casse email (parcours 3)

| #   | Action / attendu                                                                                                                                        | PASS | FAIL |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- |
| 7   | Se déconnecter. En **invité**, réserver et payer une expérience cave 1 en saisissant l'email en MAJUSCULES : `SAM.COPP8+CLIENT-FR@GMAIL.COM`            | [ ]  | [ ]  |
| 8   | Se reconnecter avec `sam.copp8+client-fr@gmail.com` → `/fr/dashboard/my-bookings` : le booking invité **apparaît** (rattachement insensible à la casse) | [ ]  | [ ]  |
| 9   | Ouvrir son détail depuis l'espace client : billet + annulation self-service proposés                                                                    | [ ]  | [ ]  |

### C. ON_SITE : empreinte SetupIntent zéro débit (parcours 4) — `NO_SHOW_FEES` ON

> ⚠ Cette partie exige le flag `NO_SHOW_FEES` ON : l'exécuter juste après
> l'activation faite en S7 (ou pendant le Volet D Bloc C — mêmes vérifs).
> Flag OFF, le comportement attendu est « réservation gratuite classique,
> aucune empreinte » (matrice OFF, UAT-CAMPAIGN §5.3).

| #   | Action / attendu                                                                                                                                                                                           | PASS | FAIL |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- |
| 10  | Connecté (+client-fr), réserver l'EXP-B (ON_SITE, cave 1, 2 pers.) : le checkout affiche **le montant des frais de no-show en clair** (15 CHF/pers.) AVANT validation + case d'acceptation de la politique | [ ]  | [ ]  |
| 11  | Valider → page Stripe en mode **empreinte** (SetupIntent, card only — pas de TWINT sur une empreinte) → saisir `4242…4242` → **aucun débit**                                                               | [ ]  | [ ]  |
| 12  | Succès : billet émis, montant à payer sur place affiché                                                                                                                                                    | [ ]  | [ ]  |
| 13  | Dashboard Stripe → Paiements : **aucun PaymentIntent débité** pour ce booking ; le SetupIntent est `succeeded`                                                                                             | [ ]  | [ ]  |
| 14  | SQL ci-dessous : empreinte + consentement horodaté remplis, aucun montant débité                                                                                                                           | [ ]  | [ ]  |

```sql
SELECT reference, status, "totalPrice", "stripePaymentIntentId",
       "stripeCustomerId", "noShowSetupIntentId", "noShowPaymentMethodId",
       "noShowPolicyAcceptedAt", "noShowPolicyVersion", "noShowFeeCentsSnapshot",
       "termsAcceptedAt"
FROM bookings WHERE reference = 'ENC-XXXXXXXX';
```

Attendus : `noShowSetupIntentId` = `seti_…`, `noShowPaymentMethodId` = `pm_…`,
`noShowPolicyAcceptedAt` non nul (horodatage du consentement),
`noShowFeeCentsSnapshot = 1500` (par personne — le prélèvement éventuel sera
`1500 × guestCount`), `stripePaymentIntentId` **null**.

> Ce booking sert de matière première à S7 (marquer no-show + prélèvement).
> Ne pas l'annuler.

## Vigilances

- Le snapshot `noShowFeeCentsSnapshot` fige le montant accepté : changer le
  réglage de la cave APRÈS la réservation ne doit rien changer au prélèvement.
- `termsAcceptedAt` (CGV + politique d'annulation, P-12) doit être rempli sur
  tout booking passé par le checkout.

## Résultat

| Verdict global | PASS [ ] · FAIL [ ] | Date/heure : `____` |
| -------------- | ------------------- | ------------------- |

Anomalies ouvertes (`UAT-S02-yy`) : `____`

## Artefacts créés

```
Booking connecté  : ENC-__________  PI : pi_______________
Booking casse email : ENC-__________
Booking ON_SITE   : ENC-__________  SetupIntent : seti_____________  pm_____________
```
