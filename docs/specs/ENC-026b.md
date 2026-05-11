# ENC-026b — Compléter page édition profil cave (revue exhaustivité des champs)

## Objectif métier
L'édition du profil de cave actuel manque plusieurs champs nécessaires soit (a) à la visibilité publique (ENC-027 — description longue, photos, géocodage), soit (b) à la qualité de l'expérience client (horaires, accessibilité, parking), soit (c) au SEO local et à la confiance (réseaux sociaux, site web, contact direct). On profite de ce passage pour faire une revue exhaustive des champs et compléter ce qui manque. Pas une refonte UX (Léa gardera la cohérence), juste une revue de complétude fonctionnelle.

## Acteurs
- **WINEMAKER** : édite son profil depuis `/dashboard/winery/edit` (ou route équivalente).

## Préconditions & déclencheurs
- Accessible depuis le dashboard encaveur, accès limité à la cave du user authentifié.
- Formulaire `react-hook-form` + Zod en place — on étend le schéma existant.

## User stories
- En tant qu'**encaveur**, je veux pouvoir renseigner tous les éléments qui décrivent ma cave (identité, accueil, contacts, services), pour donner envie aux clients de venir.
- En tant qu'**encaveur**, je veux que les champs soient regroupés de manière logique pour ne pas me perdre.

## Critères d'acceptation (Gherkin)

```gherkin
Fonctionnalité: Édition exhaustive du profil de cave

Scénario: Tous les champs sont disponibles
  Étant donné un encaveur sur /dashboard/winery/edit
  Quand il consulte le formulaire
  Alors il voit les sections : Identité, Description, Photos, Adresse, Horaires d'accueil, Contact, Langues parlées, Services, Présence web

Scénario: Sauvegarde partielle
  Étant donné un encaveur qui remplit uniquement certains champs
  Quand il sauvegarde
  Alors les champs renseignés sont persistés
  Et les champs vides restent vides sans bloquer la sauvegarde (sauf champs obligatoires identifiés)

Scénario: Validation Zod côté serveur
  Étant donné un encaveur envoyant un numéro de téléphone invalide
  Quand il soumet le formulaire
  Alors un message d'erreur i18n s'affiche au champ
  Et la sauvegarde est annulée

Scénario: Adresse modifiée — re-géocodage automatique
  Étant donné un encaveur qui modifie son adresse postale
  Quand il sauvegarde
  Alors une requête Nominatim est déclenchée
  Et les coordonnées latitude/longitude sont mises à jour
  Et si le géocodage échoue, un message non-bloquant s'affiche

Scénario: Critères de visibilité affichés
  Étant donné un encaveur qui édite son profil
  Quand un critère ENC-027 est rempli grâce à cette édition (ex: description >= 200 caractères)
  Alors une indication visuelle apparaît immédiatement (case cochée)
```

## Règles métier

### Inventaire exhaustif des champs

**Section 1 — Identité de la cave** :
- `name` (obligatoire, déjà présent)
- `slug` (auto-généré depuis name, modifiable en avancé, unicité globale — existe)
- `legalName` (raison sociale, optionnel — affichage receipt) — **à ajouter ?** (à confirmer Sam)
- `foundedYear` (optionnel, année de fondation, int) — **à ajouter ?**

**Section 2 — Description** :
- `descriptionShort` (160 caractères, utilisée en meta description et carte listing) — **à ajouter si absent**
- `description` (longue, markdown ou plain, ≥ 200 caractères pour ENC-027) — existe probablement
- `signatureWines` (liste libre des cuvées emblématiques, optionnel, texte court) — **à ajouter**

**Section 3 — Photos** :
- `coverPhoto` (1 photo obligatoire pour visibilité)
- `photos` (galerie, ≥ 3 pour visibilité — existe)
- Ordre des photos (drag & drop, optionnel MVP)

**Section 4 — Adresse** :
- `addressLine1`, `addressLine2`, `postalCode`, `city`, `region`, `country` (existe)
- `latitude`, `longitude` (auto via Nominatim, lecture seule, affiché sur mini-map) — existe
- `directionsNote` (champ texte libre "instructions d'accès", parking spécifique, point de repère — optionnel mais précieux) — **à ajouter**

**Section 5 — Horaires d'accueil** :
- `openingHours` (JSON par jour, créneaux matin/après-midi, "fermé" possible) — **à clarifier : champ existe ? format ?**
- `seasonalNote` (texte libre "Fermé pendant les vendanges en septembre", optionnel) — **à ajouter**
- Note pédagogique dans le formulaire : "Ces horaires concernent l'accueil au caveau hors expériences réservées."

**Section 6 — Contact** :
- `phone` (format suisse, validation Zod) — **à confirmer présence**
- `email` (email public, peut différer de l'email de connexion) — **à ajouter si absent**
- `contactPersonName` (nom de la personne référente, optionnel) — **à ajouter**

**Section 7 — Langues parlées à l'accueil** :
- `languagesSpoken` (multi-select : `fr`, `de`, `en`, `it`, autres) — **à ajouter**
- Important pour les Suisses alémaniques en Valais.

**Section 8 — Services & accessibilité** :
- `hasParking` (bool) — **à ajouter**
- `isWheelchairAccessible` (PMR, bool) — **à ajouter**
- `hasTastingRoom` (caveau de dégustation, bool) — **à ajouter**
- `acceptsGroups` (bool) — **à ajouter**
- `acceptsPets` (bool) — **à ajouter**
- `hasShop` (boutique sur place, bool) — **à ajouter**

**Section 9 — Présence web** :
- `website` (URL, optionnel) — **à confirmer**
- `instagram` (handle, optionnel) — **à ajouter**
- `facebook` (URL, optionnel) — **à ajouter**

### Règles de validation Zod
- `phone` : format suisse `+41 XX XXX XX XX` ou `0XX XXX XX XX`, regex flexible.
- `website`, `facebook` : URL valide, https forcé.
- `instagram` : sans @, alphanum + underscore + point.
- `email` : format valide.
- `description` : strip HTML pour comptage caractères, warning visuel à < 200 sans bloquer la sauvegarde (la sauvegarde reste possible, la visibilité publique est calculée à part).
- `languagesSpoken` : au moins une valeur recommandée (warning, pas bloquant).
- `openingHours` : un jour peut être "fermé" (null), un autre peut avoir 1 ou 2 créneaux (matin/après-midi).

### Comportement de sauvegarde
- Server action `updateWineryProfile(input)` :
  1. `await auth()` + check ownership cave.
  2. `safeParse` Zod sur l'input complet.
  3. Diff vs DB : si `address*` modifié → re-géocoder.
  4. Update Prisma.
  5. `revalidateTag('winery:{id}')` + `revalidateTag('public:wineries')`.
  6. Retour `ActionResult`.

## Copy FR définitive

| Élément | Clé i18n suggérée | Texte FR |
|---|---|---|
| Titre page | `Winery.profile.edit.title` | Profil de votre cave |
| Sous-titre | `Winery.profile.edit.subtitle` | Plus votre profil est complet, plus vous attirez de visiteurs. |
| Section 1 titre | `Winery.profile.edit.sections.identity` | Identité |
| Section 2 titre | `Winery.profile.edit.sections.description` | Description |
| Section 3 titre | `Winery.profile.edit.sections.photos` | Photos |
| Section 4 titre | `Winery.profile.edit.sections.address` | Adresse |
| Section 5 titre | `Winery.profile.edit.sections.openingHours` | Horaires d'accueil |
| Section 6 titre | `Winery.profile.edit.sections.contact` | Contact |
| Section 7 titre | `Winery.profile.edit.sections.languages` | Langues parlées |
| Section 8 titre | `Winery.profile.edit.sections.services` | Services |
| Section 9 titre | `Winery.profile.edit.sections.web` | Présence en ligne |
| Champ name | `Winery.profile.edit.fields.name` | Nom de la cave |
| Champ legalName | `Winery.profile.edit.fields.legalName` | Raison sociale (figurera sur les reçus) |
| Champ foundedYear | `Winery.profile.edit.fields.foundedYear` | Année de fondation |
| Champ descriptionShort | `Winery.profile.edit.fields.descriptionShort` | Description courte |
| Champ descriptionShort helper | `Winery.profile.edit.fields.descriptionShort.helper` | Une phrase qui résume votre cave. Affichée sur les cartes et les moteurs de recherche. |
| Champ description | `Winery.profile.edit.fields.description` | Description longue |
| Champ description helper | `Winery.profile.edit.fields.description.helper` | Racontez votre histoire, votre terroir, votre approche. 200 caractères minimum pour publier votre cave. |
| Champ signatureWines | `Winery.profile.edit.fields.signatureWines` | Cuvées emblématiques |
| Champ directionsNote | `Winery.profile.edit.fields.directionsNote` | Comment vous trouver |
| Champ directionsNote helper | `Winery.profile.edit.fields.directionsNote.helper` | Place de parking, point de repère, instructions d'accès. |
| Champ seasonalNote | `Winery.profile.edit.fields.seasonalNote` | Période de fermeture |
| Champ seasonalNote helper | `Winery.profile.edit.fields.seasonalNote.helper` | Par exemple "Fermé pendant les vendanges en septembre". |
| Champ phone | `Winery.profile.edit.fields.phone` | Téléphone |
| Champ email | `Winery.profile.edit.fields.email` | Email public |
| Champ contactPersonName | `Winery.profile.edit.fields.contactPersonName` | Personne de contact |
| Champ languagesSpoken | `Winery.profile.edit.fields.languagesSpoken` | Langues parlées au caveau |
| Champ hasParking | `Winery.profile.edit.fields.hasParking` | Parking sur place |
| Champ isWheelchairAccessible | `Winery.profile.edit.fields.isWheelchairAccessible` | Accessible aux personnes à mobilité réduite |
| Champ hasTastingRoom | `Winery.profile.edit.fields.hasTastingRoom` | Caveau de dégustation |
| Champ acceptsGroups | `Winery.profile.edit.fields.acceptsGroups` | Accueil de groupes |
| Champ acceptsPets | `Winery.profile.edit.fields.acceptsPets` | Animaux acceptés |
| Champ hasShop | `Winery.profile.edit.fields.hasShop` | Boutique sur place |
| Champ website | `Winery.profile.edit.fields.website` | Site web |
| Champ instagram | `Winery.profile.edit.fields.instagram` | Instagram |
| Champ facebook | `Winery.profile.edit.fields.facebook` | Facebook |
| Bouton sauvegarder | `Winery.profile.edit.save` | Enregistrer les modifications |
| Toast succès | `Winery.profile.edit.success` | Votre profil a été mis à jour. |
| Toast géocodage échoué | `Winery.profile.edit.geocodingFailed` | Nous n'avons pas réussi à localiser votre adresse. Vérifiez la saisie. |
| Erreur Zod téléphone | `Winery.profile.edit.errors.phone` | Format de téléphone invalide. Exemple : +41 27 322 12 34. |
| Erreur Zod url | `Winery.profile.edit.errors.url` | Adresse web invalide. |
| Indicateur visibilité titre | `Winery.profile.edit.visibility.title` | Critères de mise en ligne |
| Visibilité description ok | `Winery.profile.edit.visibility.description.done` | Description suffisamment longue |
| Visibilité photos ok | `Winery.profile.edit.visibility.photos.done` | 3 photos minimum ajoutées |

## États UI
- **Loading** : skeleton du formulaire pendant le fetch du profil existant.
- **Empty** : profil neuf (post-signup) → tous les champs vides, sections affichées dans l'ordre logique.
- **Error** : erreurs Zod inline par champ + toast global si erreur server action.
- **Populated** : valeurs remplies, indicateur visibilité ENC-027 à droite ou en bas.
- **Saving** : bouton sauvegarder en `pending` (spinner + texte "Enregistrement...").

## Cas limites
- **Encaveur supprime sa cover photo** : le profil se sauve, mais la cave devient invisible publiquement (ENC-027) et un warning apparaît.
- **Géocodage Nominatim lent ou en erreur** : on n'attend pas, on enregistre la cave, on tente le géocodage en best-effort et on log un warning si échec. L'encaveur voit un message "Localisation en cours, rechargez dans quelques secondes".
- **Champ markdown dans la description** : le rendu public devra rendre le markdown — out of scope ici, mais le champ accepte les retours à la ligne au minimum.
- **`openingHours` JSON mal formé** : validation Zod stricte, refus de la sauvegarde.
- **Langues parlées vides** : warning non bloquant ("Indiquez au moins une langue pour rassurer vos visiteurs").
- **Edit concurrent** (encaveur sur 2 onglets) : last write wins, pas de gestion optimistic concurrency MVP.
- **Email public = email de connexion** : autorisé, c'est un cas fréquent.

## Dépendances
- ENC-027 (la liste des champs influe sur la formule de visibilité).
- Schéma Prisma `Winery` — migration nécessaire pour les nouveaux champs.
- Nominatim wrapper (existe).
- Upload photos (existe).

## Hors-périmètre explicite
- Refonte UX complète de la page (Léa interviendra séparément si besoin).
- Champs métier vin (cépages, AOC, biodynamie) — utile mais à spécifier dans une US dédiée "Profil viticole".
- Multi-langue du contenu (description en FR + DE + EN saisie par l'encaveur) — post-MVP. MVP : un seul contenu, langue laissée à l'encaveur.
- Aperçu temps réel de la page publique pendant l'édition.
- Versioning / historique des modifications.
- Workflow de re-validation admin si modification après `VERIFIED`.

## Métriques de succès
- 100% des champs nouveaux sont remplis chez ≥ 70% des Fondateurs sous 14 jours.
- Aucune réclamation client type "info manquante sur la page cave".
- Géocodage automatique réussi à > 95%.

## ❓ Questions ouvertes pour Sam
1. **`legalName`** : on l'ajoute ? Pour les reçus / factures Stripe c'est important, mais Stripe a déjà cette info via le KYC. Risque de double saisie.
2. **`foundedYear`** : utile UX ou bruit ? Recommandation Théo : utile (storytelling), mais optionnel.
3. **`signatureWines`** : champ texte libre ou structure dédiée (table `Wine` avec cépage, année, prix) ? MVP : texte libre. Post-MVP : table.
4. **Markdown dans `description`** : on accepte ou pas ? Si oui, il faut un mini éditeur (TipTap) et un rendu sécurisé. MVP : suggérer juste les retours à la ligne et `**gras**`.
5. **Multi-langue du contenu** : un encaveur germanophone va saisir sa description en allemand ; un client francophone verra de l'allemand. On accepte MVP ? Recommandation Théo : oui, on accepte, et on indique sur la page publique la langue d'origine + bouton "Traduire avec DeepL" plus tard.
6. **Re-validation admin après édition profil** : si une cave VERIFIED change drastiquement sa description ou ses photos, faut-il une re-validation ? MVP : non, on fait confiance. Post-MVP : oui si signaux de changement majeur.
7. **Liste des `languagesSpoken`** : on limite à FR/DE/EN/IT ou on ouvre (ES, JA, ZH pour le tourisme asiatique) ? Recommandation : FR/DE/EN/IT MVP, le reste plus tard.
