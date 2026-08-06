# ENC-016b — Ajouter champ téléphone à l'édition profil client

## Objectif métier

L'encaveur a besoin d'un canal de contact direct le jour-J en cas d'imprévu : retard du client, météo, changement de salle, urgence médicale, etc. L'email seul ne suffit pas (latence trop élevée le jour même). On ajoute donc un champ téléphone optionnel au profil client, visible par l'encaveur sur la fiche de chaque booking. Préparation également au canal SMS de rappel (futur, hors-scope).

## Acteurs

- **CLIENT** : renseigne (ou non) son numéro dans `/account/profile`.
- **WINEMAKER** : consulte le numéro sur la page détail de la session (jour-J) si renseigné.
- **ADMIN** : voit le numéro dans le détail utilisateur back-office (audit / support).

## Préconditions & déclencheurs

- Page `/account/profile` existe déjà avec d'autres champs (nom, email, locale).
- Modèle `User` Prisma à étendre avec un champ `phone: String?` (optionnel, nullable).
- Format international **E.164** (ex: `+41791234567`) — librairie suggérée : `libphonenumber-js`.
- Validation Zod côté server action + côté formulaire client.

## User stories

- En tant que **cliente**, je veux pouvoir ajouter mon numéro de téléphone à mon profil pour que l'encaveur puisse me joindre rapidement le jour de l'expérience.
- En tant que **cliente sensible à la vie privée**, je veux que ce champ reste **facultatif** et que je puisse le supprimer à tout moment.
- En tant qu'**encaveur**, je veux voir le téléphone du client sur la fiche de la session du jour pour pouvoir l'appeler ou lui envoyer un message si besoin.
- En tant qu'**encaveur**, je dois pouvoir voir clairement quand un client n'a pas renseigné de téléphone (pour ne pas perdre de temps à chercher).

## Critères d'acceptation (Gherkin)

```gherkin
Scénario : ajout d'un téléphone valide
  Étant donné un client connecté sur /account/profile
  Quand il saisit "+41 79 123 45 67" dans le champ téléphone et soumet
  Alors le numéro est normalisé en E.164 ("+41791234567") et sauvegardé en base
  Et un toast "Profil mis à jour" s'affiche
  Et la page recharge avec le numéro affiché au format national lisible ("079 123 45 67")

Scénario : numéro avec format invalide
  Étant donné un client connecté
  Quand il saisit "123" comme téléphone et soumet
  Alors une erreur de validation s'affiche sous le champ
  Et le profil n'est pas modifié

Scénario : numéro non suisse accepté
  Étant donné une cliente française
  Quand elle saisit "+33 6 12 34 56 78"
  Alors le numéro est accepté et sauvegardé en E.164

Scénario : suppression du téléphone
  Étant donné un client avec un téléphone enregistré
  Quand il vide le champ et soumet
  Alors le champ phone passe à null en base
  Et un toast confirme la mise à jour

Scénario : encaveur consulte le détail booking d'un client avec téléphone
  Étant donné un booking CONFIRMED avec un client ayant renseigné son téléphone
  Quand l'encaveur ouvre la page détail de la session
  Alors le numéro s'affiche cliquable (tel: link) à côté du nom du client
  Et le numéro est masqué partiellement par défaut ("079 *** ** 67"), bouton "Afficher" pour révéler

Scénario : encaveur consulte le détail booking d'un client sans téléphone
  Étant donné un booking CONFIRMED avec un client sans téléphone
  Quand l'encaveur ouvre la page détail de la session
  Alors la ligne téléphone affiche "Non renseigné" en italique gris

Scénario : téléphone non visible côté CLIENT public
  Étant donné un client A qui consulte une page publique
  Quand il regarde la fiche d'un encaveur ou d'une autre cliente
  Alors le numéro de A ni d'aucun autre client n'apparaît
```

## Règles métier

- **Champ optionnel** : `User.phone` est `String?` (nullable). Pas d'obligation au signup, pas d'obligation au booking. Le client peut le renseigner ou non.
- **Format de stockage** : E.164 normalisé (`+41791234567`). Tout numéro saisi est passé dans `parsePhoneNumber()` de `libphonenumber-js` et stocké au format E.164.
- **Format d'affichage** :
  - Côté client (son propre profil) : format national du pays détecté (`079 123 45 67` pour CH, `06 12 34 56 78` pour FR).
  - Côté encaveur (fiche booking) : format international lisible (`+41 79 123 45 67`) avec **masquage partiel par défaut** (`+41 79 *** ** 67`), bouton "Afficher" qui révèle.
  - Côté admin (back-office) : numéro complet visible.
- **Validation** :
  - Zod : `z.string().refine(val => isValidPhoneNumber(val))` ou format spécifique.
  - Accepter formats locaux (`079 123 45 67`), internationaux (`+41 79 123 45 67`), avec/sans espaces.
  - Default country code : `CH` (la majorité des clients sont en Suisse). Permet de saisir `079 123 45 67` sans `+41` et que ça soit interprété correctement.
- **Pas de vérification SMS** au MVP. Le numéro est déclaré, pas vérifié. (Vérification OTP = future US si on déploie les rappels SMS.)
- **Visibilité encaveur** :
  - Le téléphone d'un client est visible **uniquement** pour l'encaveur de la winery qui héberge un booking `CONFIRMED` ou `COMPLETED` de ce client.
  - Pas de fuite : un encaveur ne doit pas voir le téléphone d'un client qui n'a pas (ou plus) de booking avec lui. Check côté query.
- **DTO côté API** : ne jamais exposer `user.phone` dans une réponse publique. Créer un DTO `ClientBookingDetailsForWinemaker` qui n'inclut `phone` que dans le contexte autorisé.
- **Pas de phone côté WINEMAKER profile** dans cette US : c'est un champ "profil client". Le winemaker a déjà ses propres coordonnées sur la fiche winery publique.
- **nLPD** : le téléphone est une donnée personnelle. Doit être inclus dans l'export `.json` (ENC-136) et anonymisé par le endpoint droit à l'oubli (ENC-135). À confirmer dans ces specs.
- **Pas de hashing** : stockage en clair. Pas de raison de hasher (besoin de l'afficher à l'encaveur). Données chiffrées au repos via Neon par défaut.

## Copy FR définitive

| Élément                 | Clé i18n suggérée                   | Texte FR                                                                                     |
| ----------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------- |
| Label champ             | `profile.phone.label`               | Numéro de téléphone                                                                          |
| Sous-label / hint       | `profile.phone.hint`                | Facultatif. L'encaveur pourra vous joindre rapidement le jour de l'expérience.               |
| Placeholder             | `profile.phone.placeholder`         | 079 123 45 67                                                                                |
| Erreur format           | `profile.phone.errorFormat`         | Le format du numéro de téléphone est invalide.                                               |
| Erreur trop court       | `profile.phone.errorTooShort`       | Numéro incomplet.                                                                            |
| Toast succès            | `profile.phone.successToast`        | Profil mis à jour.                                                                           |
| Section profil          | `profile.contact.sectionTitle`      | Coordonnées                                                                                  |
| Label vue encaveur      | `booking.detail.clientPhoneLabel`   | Téléphone                                                                                    |
| Bouton afficher         | `booking.detail.clientPhoneReveal`  | Afficher                                                                                     |
| Bouton masquer          | `booking.detail.clientPhoneHide`    | Masquer                                                                                      |
| Téléphone non renseigné | `booking.detail.clientPhoneEmpty`   | Non renseigné                                                                                |
| Tooltip encaveur        | `booking.detail.clientPhoneTooltip` | Visible uniquement pour les besoins de cette réservation. À ne pas utiliser à d'autres fins. |

## États UI

### Page `/account/profile`

- **Loading** : skeleton sur le champ (cohérent avec les autres champs du formulaire).
- **Empty (pas de phone enregistré)** : champ vide avec placeholder visible, hint affiché en sous-texte.
- **Populated** : valeur affichée formatée nationale, modifiable.
- **Error** : message rouge sous le champ, ne perd pas la saisie.
- **Saving** : bouton "Enregistrer" désactivé avec label "Enregistrement...".

### Fiche détail session (encaveur)

- **Empty (client sans phone)** : ligne "Téléphone : Non renseigné" en gris italique.
- **Populated masqué** : `+41 79 *** ** 67` + bouton lien "Afficher".
- **Populated révélé** : `+41 79 123 45 67` cliquable (`<a href="tel:...">`) + bouton lien "Masquer".

## Cas limites

- Numéro saisi avec extension (`+41 22 555 00 00 ext 123`) : `libphonenumber-js` ignore les extensions ; à clarifier si on veut les supporter. **Proposition** : on ignore les extensions, le format simple suffit pour le besoin métier (appel direct).
- Numéro de téléphone partagé entre deux comptes (cas atypique : couple, famille) : autorisé, pas d'unicité forcée sur `User.phone`. C'est une donnée déclarative.
- Client qui change de pays et garde son ancien numéro : OK, E.164 supporte tous les pays.
- Client qui supprime son téléphone alors qu'un booking CONFIRMED existe : l'encaveur verra "Non renseigné" à partir du moment de la suppression. Pas de snapshot du téléphone au moment du booking (sauf si Sam veut le contraire — cf. questions).
- Numéro suisse avec ancien préfixe (`041 79...` au lieu de `+41 79...`) : `libphonenumber-js` avec `defaultCountry: 'CH'` doit normaliser correctement. À tester.
- Tentative d'injection / XSS via le champ : Zod + parsing E.164 = pas de caractères non-numériques en sortie. Pas de risque.
- Encaveur qui exporte ses bookings en CSV (future feature) : faut-il inclure le téléphone ? **Hors-scope** ici, mais flag pour l'US export.
- Mobile : le champ doit avoir `inputMode="tel"` et `type="tel"` pour ouvrir le clavier numérique.
- Copier le numéro depuis la fiche encaveur : doit être facile (sélection texte OK, ou icône "copier" — voir Léa).

## Dépendances

- Migration Prisma : ajouter `phone String?` au modèle `User`. Migration simple, pas de backfill.
- Librairie `libphonenumber-js` (~150 ko brotli, lazy-loadable côté client).
- Validateur Zod : étendre `src/lib/validators/profile.ts` (créer si absent).
- Server action : `src/server/actions/profile/updateProfile.ts` à étendre avec le champ phone.
- Composant formulaire profil : `src/components/features/profile/ProfileForm.tsx` à étendre.
- Composant fiche encaveur : `src/components/features/dashboard/BookingClientCard.tsx` (ou équivalent — Jonas/Léa pointeront le bon).
- DTO : créer/étendre `ClientForWinemakerDTO` dans `src/types/` avec `phone?: string`.
- Tests unitaires : validation Zod (formats valides/invalides), normalisation E.164.
- Tests E2E : ajout/modif/suppression du téléphone, affichage côté encaveur masqué/révélé.
- i18n : ajouter les clés dans `messages/fr.json`, `messages/de.json`, `messages/en.json`.
- À mentionner dans ENC-135 (anonymisation nLPD) et ENC-136 (export `.json`) : ajouter le champ phone au traitement.

## Hors-périmètre explicite

- Pas de vérification SMS du numéro (pas de OTP).
- Pas de rappels SMS automatiques (future US).
- Pas de téléphone obligatoire au signup ou au checkout.
- Pas de téléphone côté encaveur (déjà géré par la fiche winery publique).
- Pas d'historique des modifications du téléphone.
- Pas de masquage configurable par le client (toujours masqué par défaut côté encaveur).
- Pas d'intégration WhatsApp / Signal / Telegram (lien tel: seulement).

## Métriques de succès

- Taux d'adoption : % de clients qui renseignent leur téléphone après inscription (cible : > 40 % à 30 jours).
- 0 incident "fuite de téléphone" vers un acteur non autorisé (CLIENT vers CLIENT, encaveur sans booking).
- Feedback qualitatif des 10 encaveurs Fondateurs : "utile / pas utile" sur le canal téléphone.

## ❓ Questions ouvertes pour Sam

- **Snapshot ou live ?** Si un client modifie/supprime son téléphone après confirmation d'un booking, l'encaveur doit-il voir le téléphone au moment du booking (snapshot figé sur `Booking`) ou la valeur live du profil client (refresh) ? **Préférence produit** : live (simplicité + cohérence avec "le client décide de sa visibilité"). À confirmer.
- **Masquage par défaut côté encaveur** : tu valides ? L'argument : éviter qu'un encaveur exfiltre des numéros via screenshot d'écran. Le clic "Afficher" laisse une trace dans les logs (à câbler en option).
- **Téléphone visible aussi sur la liste des inscrits (ENC-096)** ? Ou seulement sur la page détail individuelle ? Proposition : seulement sur le détail (un clic de plus, pas de batch view).
- **Quand on déploiera les SMS** (post-MVP), faudra-t-il une vérification OTP obligatoire ? À garder en tête pour la roadmap.
