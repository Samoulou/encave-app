# Tests manuels ENC-027 — visibilité publique cave

> **Source de vérité métier** : [`docs/specs/ENC-027.md`](./ENC-027.md) (Gherkin officiel)
> **Branche** : `samuel/enc-027-public-winery-visibility`
> **Cible** : preview Vercel ou staging `encave-dev.vercel.app`
> **Durée estimée** : 7–10 min
> **Pré-requis seed** : DB seedée avec au moins une cave VERIFIED complète, une cave PENDING, une cave VERIFIED incomplète sur chaque critère, et un compte encaveur connecté pour chaque cas.

## Notation

- ✅ = comportement attendu
- 🔴 = bug si observé
- 📸 = en cas d'échec, joindre URL + screenshot + console (F12 → Console)

---

## Scénario 1 — Cave complète et vérifiée → visible partout

**URL à tester** : `/fr/wineries` puis `/fr/wineries/[slug-cave-verified-complete]`

1. Ouvre `/fr/wineries` en navigation privée (non connecté).
2. ✅ La cave VERIFIED complète apparaît dans la liste avec son nom, photo de couverture, commune.
3. Clique sur la carte → arrive sur `/fr/wineries/[slug]`.
4. ✅ La page répond en **200**, affiche le hero, la description, la galerie, l'adresse, au moins une expérience publiée.
5. Connecte-toi en tant qu'encaveur propriétaire de cette cave → `/fr/dashboard`.
6. ✅ Le bandeau de visibilité est **vert**, titre "Votre cave est en ligne", lien vers la page publique.
7. Clique le lien du bandeau → ouvre `/fr/wineries/[slug]` en nouvel onglet.
8. ✅ Page publique accessible.

---

## Scénario 2 — Cave PENDING (jamais validée par admin) → 404 + bandeau orange

**URL à tester** : `/fr/wineries` + `/fr/wineries/[slug-cave-pending]` + `/fr/dashboard`

1. Ouvre `/fr/wineries` en navigation privée.
2. ✅ La cave PENDING **n'apparaît pas** dans la liste.
3. Tape directement `/fr/wineries/[slug-cave-pending]` dans la barre d'adresse.
4. ✅ La page renvoie un **404 i18n** (titre `Cette cave n'est pas (encore) disponible`, CTA `Découvrir les autres caves`). Pas de message "bientôt disponible" qui leakerait l'existence d'un brouillon.
5. Connecte-toi en tant qu'encaveur de la cave PENDING → `/fr/dashboard`.
6. ✅ Bandeau **orange** "Votre cave n'est pas encore visible publiquement".
7. ✅ Critère `Validation par l'équipe EnCave (en cours)` **non coché**.
8. ✅ Au moins un autre critère probablement non coché (KYC, photos, description, adresse, expérience).
9. ✅ CTA "Compléter mon profil" pointe vers `/fr/dashboard/winery/profile` (ou ancre `#payment`/`#media`/etc. selon le premier critère manquant prioritaire).

---

## Scénario 3 — Cave VERIFIED + KYC manquant → invisible + bandeau orange précis

**Pré-requis** : cave seedée avec `status=VERIFIED`, `stripeOnboardingComplete=false`, tout le reste OK.

1. Ouvre `/fr/wineries` en navigation privée → ✅ cette cave est **absente** de la liste.
2. Tape `/fr/wineries/[slug-cave-kyc-manquant]` → ✅ **404 i18n** (même rendu que scénario 2).
3. Connecte-toi en tant qu'encaveur de la cave → `/fr/dashboard`.
4. ✅ Bandeau orange.
5. ✅ Critère `Validation par l'équipe EnCave (en cours)` **coché** (status=VERIFIED).
6. ✅ Critère `Finaliser les informations bancaires (Stripe)` **non coché**.
7. ✅ CTA pointe vers `/fr/dashboard/winery/profile#payment`.

---

## Scénario 4 — Cave VERIFIED + 0 photo → invisible + bandeau orange

**Pré-requis** : cave `status=VERIFIED`, KYC ok, description ok, géocodage ok, au moins 1 expérience PUBLISHED, mais `galleryImages = []`.

1. `/fr/wineries` (incognito) → ✅ cave **absente**.
2. `/fr/wineries/[slug]` direct → ✅ **404 i18n**.
3. Dashboard encaveur → bandeau orange, critère "Ajouter au moins une photo" **non coché**.
4. ✅ CTA pointe vers `/fr/dashboard/winery/profile#media`.

---

## Scénario 5 — Cave VERIFIED + description vide ou HTML-vide → invisible

**Pré-requis** : trois variantes en DB seed (ou édite l'une via Prisma Studio) :

- (a) `description = ''`
- (b) `description = '   '` (whitespace pur)
- (c) `description = '<p>   </p>'` (HTML vide après strip tags)

Pour **chaque variante** :

1. Listing public `/fr/wineries` (incognito) → ✅ cave **absente**.
2. `/fr/wineries/[slug]` direct → ✅ **404 i18n** (le filtre SQL `description != ''` attrape (a) ; le post-filtre TS strip-tags + trim attrape (b) et (c) — c'est ce que l'US ENC-027 a explicitement décidé).
3. Dashboard encaveur → bandeau orange, critère "Rédiger une description" **non coché**.

> 🔴 Si la variante (c) `<p>   </p>` rend la page accessible en 200, c'est un bug. Le post-filtre TS est censé attraper ce cas.

---

## Scénario 6 — Cave VERIFIED complète + 0 expérience PUBLISHED → invisible

**Pré-requis** : cave `status=VERIFIED`, KYC ok, photo ok, description ok, géocodage ok, mais expériences en `DRAFT` ou `ARCHIVED` uniquement (aucune `PUBLISHED`).

1. `/fr/wineries` → ✅ cave **absente** (aucune expérience publiable, donc rien à réserver).
2. `/fr/wineries/[slug]` → ✅ **404 i18n**.
3. Dashboard encaveur → bandeau orange, critère "Publier au moins une expérience" **non coché**.
4. ✅ CTA pointe vers `/fr/dashboard/experiences/new`.

---

## Scénario 7 — Cave SUSPENDED par admin (depuis un état visible) → disparaît immédiatement

**Pré-requis** : une cave VERIFIED, complète, actuellement visible (vérifier d'abord scénario 1 OK pour cette cave).

1. Confirme que `/fr/wineries/[slug]` répond **200** et que la cave est dans le listing.
2. Connecte-toi en admin → `/fr/admin/wineries/[id]` → passe le statut à `SUSPENDED`.
3. Vide le cache navigateur (Cmd/Ctrl+Shift+R) ou attends ~5 min (les queries publiques ont un cache `revalidate: 300`).
4. Recharge `/fr/wineries` (incognito) → ✅ cave **a disparu** du listing.
5. Recharge `/fr/wineries/[slug]` → ✅ **404 i18n** (même rendu que PENDING — pas de message dédié SUSPENDED, c'est volontaire pour ne pas leak).
6. Côté encaveur connecté → ✅ bandeau orange, critère "Validation par l'équipe EnCave" **non coché**.

> 💡 Si tu n'as pas envie d'attendre le cache 5 min, force une `revalidateTag('wineries')` via une action admin existante, ou redéploie la preview.

---

## Cas que tu peux skipper si pressé

- Tester en `de` / `en` si seulement la copy FR a été touchée (le 404 i18n existe dans les 3 locales — vérifier au moins le titre `notFound.title` dans une autre locale est un bonus).
- Tester mobile — pas de responsive spécifique ajouté par ENC-027, juste un bandeau dashboard qui hérite du layout existant.

## Si un scénario échoue

Renvoie-moi via Margot : **numéro scénario + URL exacte + screenshot console (F12) + slug de la cave testée**. Idéalement copie aussi la valeur Prisma de `status`, `stripeOnboardingComplete`, `description`, `latitude`, `longitude`, `galleryImages.length`, et le statut des expériences pour reproduire en local.
