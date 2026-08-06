# ENC-068b — Joindre QR code en PNG à l'email de confirmation

## Objectif métier

Aujourd'hui le QR code est généré côté client (page de confirmation web). Les clients qui présentent leur email papier ou hors-ligne le jour de la visite n'ont pas de QR scannable. Joindre le QR en PNG dans l'email de confirmation supprime cette friction et accélère le check-in (cf. ENC-100 / ENC-101).

## Acteurs

- **CLIENT** : reçoit le QR en pièce jointe et peut le présenter même hors-ligne.
- **WINEMAKER** : scanne le QR le jour J via `/dashboard/scan`.

## Préconditions & déclencheurs

- Déclencheur : passage d'un booking en `CONFIRMED` (webhook `checkout.session.completed` → service email).
- Le booking doit avoir un `accessTokenHash` persisté et un `bookingReference` (`ENC-XXXXXX`).
- Email transactionnel envoyé via Resend, rendu via React Email.

## User stories

- En tant que **client**, je veux retrouver mon QR directement dans mon email de confirmation, sans avoir besoin de me connecter ou d'ouvrir un lien.
- En tant qu'**encaveur**, je veux qu'un client qui me montre l'email papier ait un QR scannable.

## Critères d'acceptation (Gherkin)

```gherkin
Scénario : QR code attaché à l'email de confirmation
  Étant donné une réservation qui vient de passer à CONFIRMED
  Quand le service BookingConfirmationEmail.send() est invoqué
  Alors un PNG nommé "billet-ENC-XXXXXX.png" est joint à l'email
  Et le PNG encode l'URL https://encave.ch/api/checkin/{accessToken}
  Et le PNG est aussi affiché inline dans le corps de l'email via Content-ID
  Et la taille du PNG est comprise entre 8 et 30 Ko

Scénario : génération serveur (pas Resend, pas client)
  Quand le PNG est généré
  Alors il est produit côté serveur Next.js avant l'appel à Resend
  Et la lib utilisée est qrcode (npm) côté Node, pas une lib client

Scénario : email rendu sans QR si erreur génération
  Étant donné que la génération du QR échoue (exception)
  Quand le service email s'exécute
  Alors l'email part quand même avec un lien de secours "Afficher mon billet en ligne"
  Et l'incident est loggé en error et envoyé à Sentry

Scénario : check-in via QR
  Étant donné qu'un encaveur scanne le QR avec /dashboard/scan
  Quand l'URL est ouverte
  Alors le endpoint /api/checkin/{accessToken} résout le booking, vérifie l'appartenance à la cave et permet la transition CONFIRMED → COMPLETED
```

## Règles métier

- **Format** : PNG, **512×512 px**, niveau de correction d'erreur **M** (15 %), marge `quietZone: 2`, fond blanc, modules noir #0A0A0A. Cohérent avec la version web actuelle.
- **Contenu encodé** : URL absolue `https://{BASE_URL}/api/checkin/{accessToken}` où `accessToken` est le **token en clair** (jamais le hash). Le token clair n'est connu qu'à la création du booking et stocké uniquement comme hash en DB (cf. CLAUDE.md). On le passe au service email au moment où il est encore en mémoire dans l'action `confirmBooking`.
- **Justification du choix accessToken vs bookingReference** : `bookingReference` est lisible et devinable côté humain ; `accessToken` est un secret. Le scan doit authentifier le porteur du QR. Recommandation Théo : **encoder l'accessToken**, c'est la pratique standard (ticket = secret porteur).
- **Pièce jointe** :
  - Nom : `billet-{bookingReference}.png`
  - MIME : `image/png`
  - Inline via `cid:` pour affichage dans le corps + attachée pour télécharger.
- **Génération** : `src/server/services/qr-code.service.ts` utilisant `qrcode` (npm). Fonction `generateBookingQR(accessToken: string): Promise<Buffer>`.
- **Lib React Email** : `<Img src="cid:qr-code" />` + attachement avec `cid: 'qr-code'` côté Resend.
- **Cache** : pas de cache (booking-spécifique, généré 1x par envoi email).
- **i18n** : le PNG n'est pas traduit (URL technique), seul le texte autour l'est.

## Copy FR définitive

| Élément                         | Clé i18n suggérée                       | Texte FR                                                                                                              |
| ------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Section QR — titre              | `Email.bookingConfirmation.qr.title`    | Votre billet                                                                                                          |
| Section QR — intro              | `Email.bookingConfirmation.qr.intro`    | Présentez ce QR code à votre encaveur le jour J. Vous pouvez aussi enregistrer la pièce jointe ou imprimer cet email. |
| Alt image                       | `Email.bookingConfirmation.qr.alt`      | QR code de votre billet EnCave                                                                                        |
| Fallback (si génération échoue) | `Email.bookingConfirmation.qr.fallback` | Retrouvez votre billet en ligne : {link}                                                                              |
| Légende                         | `Email.bookingConfirmation.qr.caption`  | Référence : {bookingReference}                                                                                        |

## États UI

- **Loading** : N/A.
- **Empty** : N/A (toujours un QR pour un booking CONFIRMED).
- **Error** : email envoyé sans QR + lien fallback + Sentry.
- **Populated** : email avec QR inline + attachement PNG.

## Cas limites

- Client mobile qui n'affiche pas les images inline (Gmail mode texte) : l'attachement PNG reste disponible.
- Provider qui strip les CID inline (rare) : alt-text + lien fallback visibles.
- Booking re-confirmé après une annulation (cas reschedule futur) : régénération avec nouveau accessToken.
- Email rejoué (Resend retry) : pas d'effet de bord, c'est une lecture du booking.

## Dépendances

- `src/server/services/booking-confirmation-email.service.ts` (existant) à enrichir.
- Lib `qrcode` à ajouter aux deps.
- Endpoint `/api/checkin/{accessToken}` existe déjà (utilisé par la page web actuelle).
- Pas de migration DB.

## Hors-périmètre explicite

- Pas de QR pour le +1 invité (cf. ENC-084).
- Pas de wallet Apple/Google Pass.
- Pas de re-génération à la demande du client (page web reste source pour ça).
- Pas de QR pour les bookings PENDING_PAYMENT ou autres statuts.

## Métriques de succès

- 100 % des emails de confirmation contiennent l'attachement PNG (monitoring Resend).
- Taux de scan QR le jour J > 70 % des check-in (vs check-in manuel).

## ❓ Questions ouvertes pour Sam

- **Logo EnCave au centre du QR ?** Pro : reconnaissance brand, premium. Con : réduit légèrement la robustesse de scan, complexifie la génération. **Reco Théo** : pas de logo en MVP, on en discute en V2.
- **Inclure le QR dans l'email de rappel J-1 / H-2 aussi ?** Cohérent UX mais alourdit les emails. **Reco Théo** : oui dans l'email H-2 uniquement (plus pertinent à J-1 que le rappel froid).
