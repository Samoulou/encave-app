# EnCave Front-End Specification

## Document Info

| Field        | Value                                     |
| ------------ | ----------------------------------------- |
| **Project**  | EnCave - Wine Experience Booking Platform |
| **Version**  | 2.0                                       |
| **Date**     | 2026-01-07                                |
| **Author**   | Sally (UX Expert)                         |
| **Status**   | Ready for Implementation                  |
| **Coverage** | 30 screens across 4 epics                 |

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [Screen Index](#2-screen-index)
3. [Epic 1: Foundation & Identity](#3-epic-1-foundation--identity)
4. [Epic 2: Experience Catalog & Discovery](#4-epic-2-experience-catalog--discovery)
5. [Epic 3: Booking & Payments](#5-epic-3-booking--payments)
6. [Epic 4: Operations & Launch](#6-epic-4-operations--launch)
7. [Component Specifications](#7-component-specifications)
8. [Design Tokens](#8-design-tokens)
9. [Animation & Transitions](#9-animation--transitions)
10. [Responsive Breakpoints](#10-responsive-breakpoints)
11. [Accessibility Requirements](#11-accessibility-requirements)
12. [Email Templates](#12-email-templates)
13. [Implementation Notes](#13-implementation-notes)

---

## 1. Design Philosophy

### Vision

EnCave should feel like a **premium yet approachable** wine discovery platform - sophisticated enough to reflect the quality of Valais wines, but simple enough that a tourist can book an experience in under 2 minutes.

### Design Pillars

| Pillar                   | Description                                                  |
| ------------------------ | ------------------------------------------------------------ |
| **Simplicity**           | Minimal steps from discovery to booking (3-click booking)    |
| **Trust**                | Clear pricing, transparent policies, verified winemakers     |
| **Local Authenticity**   | Visual identity rooted in Valais terroir and wine culture    |
| **Dual-Persona Clarity** | Distinct but coherent experiences for clients vs. winemakers |

### Key Interaction Paradigms

| Paradigm                    | Description                                                     |
| --------------------------- | --------------------------------------------------------------- |
| Search-first discovery      | Homepage prominently features search (date, location, type)     |
| Card-based browsing         | Experiences displayed as visual cards with photo, price, rating |
| Linear booking flow         | Step-by-step: Select -> Configure -> Pay -> Confirm             |
| Dashboard for professionals | Winemakers get a functional admin panel                         |
| Progressive disclosure      | Show essential info first, details on demand                    |

---

## 2. Screen Index

### Public Routes

| Route                        | Screen               | Epic |
| ---------------------------- | -------------------- | ---- |
| `/`                          | Homepage             | 2    |
| `/login`                     | Login                | 1    |
| `/register`                  | Register             | 1    |
| `/wineries`                  | Winery Directory     | 1    |
| `/wineries/[slug]`           | Winery Detail        | 1    |
| `/experiences`               | Experience Search    | 2    |
| `/experiences/[slug]`        | Experience Detail    | 2, 3 |
| `/checkout`                  | Checkout & Payment   | 3    |
| `/booking/[id]`              | Client Booking View  | 3    |
| `/booking/[id]/confirmation` | Booking Confirmation | 3    |
| `/404`                       | Not Found            | 4    |
| `/500`                       | Server Error         | 4    |

### Winemaker Dashboard Routes

| Route                               | Screen                  | Epic |
| ----------------------------------- | ----------------------- | ---- |
| `/onboarding/winery`                | Winery Onboarding       | 1    |
| `/onboarding/confirmation`          | Onboarding Confirmation | 1    |
| `/dashboard`                        | Dashboard Home          | 4    |
| `/dashboard/stripe/callback`        | Stripe Callback         | 3    |
| `/dashboard/winery/profile`         | Winery Profile Edit     | 1    |
| `/dashboard/experiences`            | Experience List         | 2    |
| `/dashboard/experiences/new`        | Create Experience       | 2    |
| `/dashboard/experiences/[id]/edit`  | Edit Experience         | 2    |
| `/dashboard/bookings`               | Bookings List           | 4    |
| `/dashboard/bookings?view=calendar` | Calendar View           | 4    |
| `/dashboard/earnings`               | Earnings                | 4    |
| `/dashboard/settings/notifications` | Notification Settings   | 4    |

### Admin Routes

| Route                     | Screen          | Epic |
| ------------------------- | --------------- | ---- |
| `/admin`                  | Admin Dashboard | 1    |
| `/admin/wineries/pending` | Pending Queue   | 1    |
| `/admin/wineries/[id]`    | Winery Review   | 1    |

---

## 3. Epic 1: Foundation & Identity

### 3.1 Login Page (`/login`)

**Purpose:** Secure sign-in for returning users

```
+-----------------------------------------+
|                                         |
|            [wine] EnCave                |
|                                         |
|     Connectez-vous a votre compte       |
|                                         |
+-----------------------------------------+
|                                         |
| +-------------------------------------+ |
| | [G] Continuer avec Google           | |
| +-------------------------------------+ |
|                                         |
| -------------- ou --------------        |
|                                         |
| Email                                   |
| +-------------------------------------+ |
| | marie@example.com                   | |
| +-------------------------------------+ |
|                                         |
| Mot de passe                            |
| +-------------------------------------+ |
| | ********                      [eye] | |
| +-------------------------------------+ |
|                                         |
|            Mot de passe oublie?         |
|                                         |
| +-------------------------------------+ |
| |          SE CONNECTER               | |
| +-------------------------------------+ |
|                                         |
|  Pas encore de compte? Creer un compte  |
|                                         |
+-----------------------------------------+
```

**Component Specifications:**

```typescript
interface LoginFormProps {
  onSubmit: (credentials: LoginCredentials) => Promise<void>;
  isLoading: boolean;
  error?: string;
  locale: 'fr' | 'de';
}

interface LoginCredentials {
  email: string;
  password: string;
}
```

**Validation:**

| Field      | Rules                        |
| ---------- | ---------------------------- |
| `email`    | Required, valid email format |
| `password` | Required, min 8 chars        |

---

### 3.2 Registration Page (`/register`)

**Purpose:** New user account creation with role selection

```
+-----------------------------------------+
|                                         |
|            [wine] EnCave                |
|                                         |
|        Creez votre compte               |
|                                         |
+-----------------------------------------+
|                                         |
| +-------------------------------------+ |
| | [G] Continuer avec Google           | |
| +-------------------------------------+ |
|                                         |
| -------------- ou --------------        |
|                                         |
| Prenom                                  |
| +-------------------------------------+ |
| | Marie                               | |
| +-------------------------------------+ |
|                                         |
| Nom                                     |
| +-------------------------------------+ |
| | Dupont                              | |
| +-------------------------------------+ |
|                                         |
| Email                                   |
| +-------------------------------------+ |
| | marie@example.com                   | |
| +-------------------------------------+ |
|                                         |
| Mot de passe                            |
| +-------------------------------------+ |
| | ********                      [eye] | |
| +-------------------------------------+ |
| [i] Min 8 caracteres, dont 1 chiffre    |
|                                         |
| Confirmer le mot de passe               |
| +-------------------------------------+ |
| | ********                      [eye] | |
| +-------------------------------------+ |
|                                         |
| +-------------------------------------+ |
| | [ ] Je suis vigneron et souhaite    | |
| |     proposer des experiences        | |
| +-------------------------------------+ |
|                                         |
| +-------------------------------------+ |
| |       CREER MON COMPTE              | |
| +-------------------------------------+ |
|                                         |
|   Deja un compte? Se connecter          |
|                                         |
+-----------------------------------------+
```

**Validation:**

| Field             | Rules                                    |
| ----------------- | ---------------------------------------- |
| `firstName`       | Required, 2-50 chars                     |
| `lastName`        | Required, 2-50 chars                     |
| `email`           | Required, valid email, unique            |
| `password`        | Required, min 8 chars, at least 1 number |
| `confirmPassword` | Must match password                      |

**Flow after registration:**

- If `isWinemaker` checked -> redirect to `/onboarding/winery`
- If not -> redirect to `/` (homepage)

---

### 3.3 Winery Onboarding (`/onboarding/winery`)

**Purpose:** Collect winery information for verification

```
+-----------------------------------------+
| <- Retour                               |
+-----------------------------------------+
|                                         |
|     Enregistrez votre cave              |
|                                         |
|     Etape 1 sur 2 - Informations        |
|     [============----------] 50%        |
|                                         |
+-----------------------------------------+
|                                         |
| [wine] INFORMATIONS DE LA CAVE          |
|                                         |
| Nom de la cave *                        |
| +-------------------------------------+ |
| | Cave du Rhodan                      | |
| +-------------------------------------+ |
| Sera utilise comme identifiant public   |
|                                         |
| Description *                           |
| +-------------------------------------+ |
| | Situee au coeur de Salquenen,       | |
| | notre cave familiale cultive        | |
| | depuis trois generations des        | |
| | cepages autochtones du Valais...    | |
| +-------------------------------------+ |
| 67/50 caracteres minimum                |
|                                         |
| [pin] LOCALISATION                      |
|                                         |
| Commune *                               |
| +-------------------------------------+ |
| | Salquenen                        v  | |
| +-------------------------------------+ |
|                                         |
| Adresse complete *                      |
| +-------------------------------------+ |
| | Route du Village 12                 | |
| | 3970 Salquenen                      | |
| +-------------------------------------+ |
|                                         |
| [phone] CONTACT                         |
|                                         |
| Telephone *                             |
| +-------------------------------------+ |
| | +41 27 456 78 90                    | |
| +-------------------------------------+ |
|                                         |
+-----------------------------------------+
|                                         |
| +-------------------------------------+ |
| |          CONTINUER ->               | |
| +-------------------------------------+ |
|                                         |
+-----------------------------------------+
```

**Validation:**

| Field         | Rules                           |
| ------------- | ------------------------------- |
| `name`        | Required, 3-100 chars, unique   |
| `description` | Required, min 50 chars          |
| `commune`     | Required, from list             |
| `address`     | Required                        |
| `phone`       | Required, Swiss format (+41...) |

**Commune Dropdown (Valais):** Sierre, Sion, Martigny, Monthey, Salquenen, Fully, Chamoson, Leytron, Vetroz, Conthey, Saviese, Grimisuat, Ayent, Lens, Crans-Montana, Visperterminen, Visp, Brig, etc.

---

### 3.4 Onboarding Confirmation (`/onboarding/confirmation`)

**Purpose:** Confirm submission and explain next steps

```
+-----------------------------------------+
|                                         |
|              [check]                    |
|           +-------+                     |
|           | [doc] |                     |
|           +-------+                     |
|                                         |
|    Demande envoyee avec succes !        |
|                                         |
+-----------------------------------------+
|                                         |
| +-------------------------------------+ |
| | Prochaines etapes                   | |
| |                                     | |
| | 1. Notre equipe examine votre       | |
| |    demande sous 48-72h              | |
| |                                     | |
| | 2. Vous recevrez un email de        | |
| |    confirmation une fois verifie    | |
| |                                     | |
| | 3. Vous pourrez alors creer vos     | |
| |    experiences et accepter des      | |
| |    reservations                     | |
| +-------------------------------------+ |
|                                         |
| +-------------------------------------+ |
| | [email] Un email de confirmation    | |
| |    a ete envoye a marie@example.com | |
| +-------------------------------------+ |
|                                         |
+-----------------------------------------+
|                                         |
| +-------------------------------------+ |
| |      RETOUR A L'ACCUEIL             | |
| +-------------------------------------+ |
|                                         |
+-----------------------------------------+
```

---

### 3.5 Winery Profile Edit (`/dashboard/winery/profile`)

**Purpose:** Manage winery information and photos

```
+-----------------------------------------+
| [menu] EnCave Dashboard    Marie D. v   |
+-----------------------------------------+
| Dashboard | Profil | Exper. | Reserv.   |
+-----------------------------------------+
|                                         |
| Profil de la cave                       |
| Derniere mise a jour: 7 jan 2026        |
|                                         |
| +-------------------------------------+ |
| | [eye] Voir le profil public         | |
| +-------------------------------------+ |
|                                         |
+-----------------------------------------+
|                                         |
| [img] PHOTO DE COUVERTURE               |
|                                         |
| +-------------------------------------+ |
| |                                     | |
| |     [Current cover image]           | |
| |                                     | |
| |              [cam] Modifier         | |
| +-------------------------------------+ |
| Recommande: 1200x675px (16:9)           |
|                                         |
| [img] GALERIE PHOTOS (4/6)              |
|                                         |
| +------+ +------+ +------+              |
| | img1 | | img2 | | img3 |              |
| |   x  | |   x  | |   x  |              |
| +------+ +------+ +------+              |
| +------+ +------+                       |
| | img4 | |  +   | Ajouter               |
| |   x  | |photo |                       |
| +------+ +------+                       |
|                                         |
+-----------------------------------------+
|                                         |
| [wine] INFORMATIONS                     |
|                                         |
| Nom de la cave *                        |
| +-------------------------------------+ |
| | Cave du Rhodan                      | |
| +-------------------------------------+ |
|                                         |
| Description *                           |
| +-------------------------------------+ |
| | Situee au coeur de Salquenen...     | |
| +-------------------------------------+ |
|                                         |
+-----------------------------------------+
|                                         |
| +-------------------------------------+ |
| |    ENREGISTRER LES MODIFICATIONS    | |
| +-------------------------------------+ |
|                                         |
+-----------------------------------------+
```

**Image Upload Specs:**

| Property         | Value                       |
| ---------------- | --------------------------- |
| Max file size    | 5MB                         |
| Accepted formats | JPEG, PNG, WebP             |
| Cover ratio      | 16:9 (1200x675 recommended) |
| Gallery max      | 6 images                    |

---

### 3.6 Admin Dashboard (`/admin`)

**Purpose:** Admin overview with quick access to pending items

```
+-----------------------------------------+
| [tool] EnCave Admin          Admin v    |
+-----------+-----------------------------+
|           |                             |
| Dashboard | Tableau de bord             |
|           |                             |
| Caves     | +-------------------------+ |
|  - En att.| | [chart] Statistiques    | |
|  - Toutes | |                         | |
|           | | Caves verifiees    12   | |
| Utilisat. | | En attente          3   | |
|           | | Experiences         28  | |
|           | | Reservations (sem)  47  | |
|           | +-------------------------+ |
|           |                             |
|           | +-------------------------+ |
|           | | [!] Actions requises    | |
|           | |                         | |
|           | | [red] 3 caves en        | |
|           | |    attente [Voir ->]    | |
|           | +-------------------------+ |
|           |                             |
+-----------+-----------------------------+
```

---

### 3.7 Admin Pending Queue (`/admin/wineries/pending`)

**Purpose:** List and manage wineries awaiting verification

```
+-----------------------------------------+
| [tool] EnCave Admin          Admin v    |
+-----------+-----------------------------+
|           |                             |
| Dashboard | Caves en attente (3)        |
|           |                             |
| Caves     | +-------------------------+ |
| > En att. | | Filtrer: [Toutes v]     | |
|   Toutes  | | Trier:   [Date v]       | |
|           | +-------------------------+ |
| Utilisat. |                             |
|           | +-------------------------+ |
|           | | Domaine des Muses       | |
|           | | [pin] Fully             | |
|           | | [mail] jean@muses.ch    | |
|           | | [cal] Inscrit il y a 2h | |
|           | |           [Examiner ->] | |
|           | +-------------------------+ |
|           |                             |
|           | +-------------------------+ |
|           | | Cave de la Colline      | |
|           | | [pin] Sion              | |
|           | | [mail] info@colline.ch  | |
|           | | [cal] Inscrit il y a 1j | |
|           | |           [Examiner ->] | |
|           | +-------------------------+ |
|           |                             |
+-----------+-----------------------------+
```

---

### 3.8 Admin Winery Review (`/admin/wineries/[id]`)

**Purpose:** Review winery details and approve/reject

```
+-----------------------------------------+
| [tool] EnCave Admin          Admin v    |
+-----------+-----------------------------+
|           |                             |
| Dashboard | <- Retour a la liste        |
|           |                             |
| Caves     | Domaine des Muses           |
| > En att. | Statut: [yellow] EN ATTENTE |
|   Toutes  |                             |
|           | +-------------------------+ |
| Utilisat. | | [doc] INFORMATIONS      | |
|           | |                         | |
|           | | Nom: Domaine des Muses  | |
|           | | Commune: Fully          | |
|           | | Adresse: Chemin des     | |
|           | |   Vignes 8, 1926 Fully  | |
|           | | Telephone: +41 27 123.. | |
|           | | Email: jean@muses.ch    | |
|           | +-------------------------+ |
|           |                             |
|           | +-------------------------+ |
|           | | [doc] DESCRIPTION       | |
|           | |                         | |
|           | | Notre domaine familial  | |
|           | | est situe sur les       | |
|           | | coteaux ensoleilles...  | |
|           | +-------------------------+ |
|           |                             |
|           | +-------------------------+ |
|           | | Motif de refus          | |
|           | | (requis si refuse)      | |
|           | | +---------------------+ | |
|           | | |                     | | |
|           | | +---------------------+ | |
|           | +-------------------------+ |
|           |                             |
|           | +---------+ +-------------+ |
|           | | REFUSER | |  APPROUVER  | |
|           | |    x    | |      ok     | |
|           | +---------+ +-------------+ |
|           |                             |
+-----------+-----------------------------+
```

---

### 3.9 Public Winery Directory (`/wineries`)

**Purpose:** Browse verified wineries in Valais

```
+-----------------------------------------+
| [wine] EnCave        FR|DE    Connexion |
+-----------------------------------------+
|                                         |
|     Les caves du Valais                 |
|     Decouvrez nos vignerons partenaires |
|                                         |
| +-------------------------------------+ |
| | [pin] Filtrer par commune           | |
| | [Toutes les communes            v]  | |
| +-------------------------------------+ |
|                                         |
|  12 caves verifiees                     |
|                                         |
+-----------------------------------------+
|                                         |
| +-------+ +-------+ +-------+           |
| |[img]  | |[img]  | |[img]  |           |
| |       | |       | |       |           |
| | Cave  | |Domaine| | Cave  |           |
| | du    | | Muses | | de la |           |
| | Rhodan| |       | |Colline|           |
| |       | |       | |       |           |
| |Salque.| | Fully | | Sion  |           |
| +-------+ +-------+ +-------+           |
|                                         |
| +-------+ +-------+ +-------+           |
| |[img]  | |[img]  | |[img]  |           |
| |...    | |...    | |...    |           |
| +-------+ +-------+ +-------+           |
|                                         |
|          [Charger plus...]              |
|                                         |
+-----------------------------------------+
```

**Responsive Grid:**

| Breakpoint     | Columns |
| -------------- | ------- |
| Mobile (xs-sm) | 1       |
| Tablet (md)    | 2       |
| Desktop (lg+)  | 3       |

---

### 3.10 Public Winery Detail (`/wineries/[slug]`)

**Purpose:** Full public profile of a winery

```
+-----------------------------------------+
| [wine] EnCave        FR|DE    Connexion |
+-----------------------------------------+
| <- Toutes les caves                     |
+-----------------------------------------+
| +-------------------------------------+ |
| |                                     | |
| |     [COVER IMAGE - FULL WIDTH]      | |
| |                                     | |
| +-------------------------------------+ |
|                                         |
|  Cave du Rhodan                         |
|  ====================================   |
|                                         |
|  [pin] Salquenen, Valais                |
|  [check] Vigneron verifie               |
|                                         |
+-----------------------------------------+
|                                         |
|  A propos                               |
|  --------                               |
|                                         |
|  Situee au coeur de Salquenen, notre    |
|  cave familiale cultive depuis trois    |
|  generations des cepages autochtones    |
|  du Valais...                           |
|                                         |
+-----------------------------------------+
|                                         |
|  [cam] Galerie                          |
|  -------------                          |
|                                         |
|  +------+ +------+ +------+             |
|  | img1 | | img2 | | img3 |             |
|  +------+ +------+ +------+             |
|                                         |
+-----------------------------------------+
|                                         |
|  [pin] Nous trouver                     |
|  ------------------                     |
|                                         |
|  Route du Village 12                    |
|  3970 Salquenen                         |
|                                         |
|  [Voir sur Google Maps ->]              |
|                                         |
|  [phone] +41 27 456 78 90               |
|  [mail] contact@cave-rhodan.ch          |
|                                         |
+-----------------------------------------+
|                                         |
| +-------------------------------------+ |
| | [wine] Experiences                  | |
| |                                     | |
| |    Bientot disponible!              | |
| |                                     | |
| | +-------------------------------+   | |
| | | M'avertir des disponibilites  |   | |
| | +-------------------------------+   | |
| +-------------------------------------+ |
|                                         |
+-----------------------------------------+
```

---

## 4. Epic 2: Experience Catalog & Discovery

### 4.1 Homepage (`/`)

**Purpose:** Search-first discovery with featured experiences

```
+-----------------------------------------+
| [wine] EnCave        FR|DE    Connexion |
+-----------------------------------------+
| +-------------------------------------+ |
| |                                     | |
| |     [HERO IMAGE - VALAIS VINEYARD]  | |
| |                                     | |
| |     Decouvrez les vins du Valais    | |
| |                                     | |
| | +----------------------------------+| |
| | | [search] Que cherchez-vous?      || |
| | | +------------------------------+ || |
| | | | Degustation, visite...       | || |
| | | +------------------------------+ || |
| | |                                  || |
| | | [cal] Date      [users] Pers.   || |
| | | [Choisir v]     [2 pers.   v]   || |
| | |                                  || |
| | | +------------------------------+ || |
| | | |       RECHERCHER             | || |
| | | +------------------------------+ || |
| | +----------------------------------+| |
| |                                     | |
| +-------------------------------------+ |
|                                         |
+-----------------------------------------+
|                                         |
|  Types d'experiences                    |
|  -------------------                    |
|                                         |
|  +-----+ +-----+ +-----+ +-----+        |
|  |[wne]| |[bld]| |[chf]| |[grp]|        |
|  |     | |     | |     | |     |        |
|  |Degus| |Visit| |Atel.| |Vigne|        |
|  +-----+ +-----+ +-----+ +-----+        |
|                                         |
+-----------------------------------------+
|                                         |
|  Experiences populaires                 |
|  ----------------------                 |
|                                         |
|  +--------+ +--------+ +--------+       |
|  |[img]   | |[img]   | |[img]   |       |
|  |        | |        | |        |       |
|  |TASTING | |VISITE  | |ATELIER |       |
|  |        | |        | |        |       |
|  |Decouv. | |Cave    | |Assem-  |       |
|  |Crus    | |Histor. | |blage   |       |
|  |        | |        | |        |       |
|  |Cave du | |Domaine | |Vignoble|       |
|  |Rhodan  | |Muses   | |Soleil  |       |
|  |        | |        | |        |       |
|  |CHF 45  | |CHF 35  | |CHF 85  |       |
|  |90 min  | |60 min  | |3h      |       |
|  +--------+ +--------+ +--------+       |
|                                         |
|      [Voir toutes les experiences ->]   |
|                                         |
+-----------------------------------------+
```

**Experience Types:**

| Type            | Icon     | French           | German          |
| --------------- | -------- | ---------------- | --------------- |
| `TASTING`       | wine     | Degustation      | Degustation     |
| `CELLAR_VISIT`  | building | Visite de cave   | Kellerbesuch    |
| `WORKSHOP`      | chef     | Atelier          | Workshop        |
| `VINEYARD_TOUR` | grape    | Visite vignoble  | Weinbergfuhrung |
| `FOOD_PAIRING`  | cheese   | Accord mets-vins | Weinbegleitung  |

---

### 4.2 Create Experience (`/dashboard/experiences/new`)

**Purpose:** Multi-section form to create a new experience

```
+-----------------------------------------+
| [menu] EnCave Dashboard    Marie D. v   |
+-----------------------------------------+
| Dashboard | Profil |>Exper.<| Reserv.   |
+-----------------------------------------+
|                                         |
| <- Retour aux experiences               |
|                                         |
| Creer une experience                    |
| =======================                 |
|                                         |
| +-------------------------------------+ |
| | [i] L'experience sera creee en mode | |
| |    brouillon. Vous pourrez la       | |
| |    publier apres avoir configure    | |
| |    les disponibilites.              | |
| +-------------------------------------+ |
|                                         |
+-----------------------------------------+
|                                         |
| [cam] PHOTOS                            |
|                                         |
| Photo de couverture *                   |
| +-------------------------------------+ |
| |                                     | |
| |      +---------------------+        | |
| |      |   [cam]             |        | |
| |      |   Glissez une image |        | |
| |      |   ou cliquez        |        | |
| |      +---------------------+        | |
| |                                     | |
| +-------------------------------------+ |
| Format 16:9 recommande - Max 5MB        |
|                                         |
+-----------------------------------------+
|                                         |
| [doc] INFORMATIONS DE BASE              |
|                                         |
| Titre *                                 |
| +-------------------------------------+ |
| | Decouverte des Crus du Valais       | |
| +-------------------------------------+ |
| 35/100 caracteres                       |
|                                         |
| Type d'experience *                     |
| +-------------------------------------+ |
| | [wine] Degustation               v  | |
| +-------------------------------------+ |
|                                         |
| Description *                           |
| +-------------------------------------+ |
| | Plongez dans l'univers des vins     | |
| | valaisans avec notre degustation    | |
| | guidee...                           | |
| +-------------------------------------+ |
| 156/100 caracteres minimum              |
|                                         |
+-----------------------------------------+
|                                         |
| [clock] DUREE ET CAPACITE               |
|                                         |
| Duree *                                 |
| +-------------------------------------+ |
| | 1h30                             v  | |
| +-------------------------------------+ |
|                                         |
| Capacite                                |
| +-------------+  +-------------+        |
| | Min: 2   v  |  | Max: 8   v  |        |
| +-------------+  +-------------+        |
|                                         |
+-----------------------------------------+
|                                         |
| [money] TARIFICATION                    |
|                                         |
| Prix par personne *                     |
| +-------------------------------------+ |
| | CHF  45                             | |
| +-------------------------------------+ |
|                                         |
+-----------------------------------------+
|                                         |
| +-------------+ +---------------------+ |
| |   Annuler   | |  CREER BROUILLON   | |
| +-------------+ +---------------------+ |
|                                         |
+-----------------------------------------+
```

**Duration Options:**

| Value | Label FR     | Label DE    |
| ----- | ------------ | ----------- |
| 60    | 1 heure      | 1 Stunde    |
| 90    | 1h30         | 1.5 Stunden |
| 120   | 2 heures     | 2 Stunden   |
| 180   | 3 heures     | 3 Stunden   |
| 240   | Demi-journee | Halbtag     |

---

### 4.3 Experience Dashboard (`/dashboard/experiences`)

**Purpose:** List and manage all winemaker's experiences

```
+-----------------------------------------+
| [menu] EnCave Dashboard    Marie D. v   |
+-----------------------------------------+
| Dashboard | Profil |>Exper.<| Reserv.   |
+-----------------------------------------+
|                                         |
| Mes experiences                         |
| ===============                         |
|                                         |
| +-------------------------------------+ |
| |      + CREER UNE EXPERIENCE         | |
| +-------------------------------------+ |
|                                         |
| +-------------------+ +-----------+     |
| | Trier: [Recent v] | |[s] Filtrer|     |
| +-------------------+ +-----------+     |
|                                         |
|  3 experiences                          |
|                                         |
+-----------------------------------------+
|                                         |
| +-------------------------------------+ |
| | +---+                               | |
| | |img| Decouverte des Crus      [:]  | |
| | +---+ [wine] Degustation            | |
| |                                     | |
| | CHF 45 - 90 min - 2-8 pers.         | |
| |                                     | |
| | [green] PUBLIE   Modifie il y a 2j  | |
| |                                     | |
| | [Modifier] [Disponibilites] [:]     | |
| +-------------------------------------+ |
|                                         |
| +-------------------------------------+ |
| | +---+                               | |
| | |img| Visite de Cave Histor.   [:]  | |
| | +---+ [bld] Visite de cave          | |
| |                                     | |
| | CHF 35 - 60 min - 4-12 pers.        | |
| |                                     | |
| | [green] PUBLIE   Modifie il y a 5j  | |
| +-------------------------------------+ |
|                                         |
| +-------------------------------------+ |
| | +---+                               | |
| | |img| Atelier Assemblage       [:]  | |
| | +---+ [chef] Atelier                | |
| |                                     | |
| | CHF 120 - 3h - 2-6 pers.            | |
| |                                     | |
| | [gray] BROUILLON Modifie il y a 1s  | |
| | [!] Aucune disponibilite configuree | |
| +-------------------------------------+ |
|                                         |
+-----------------------------------------+
```

**Status Badges:**

| Status      | Color | Label FR  |
| ----------- | ----- | --------- |
| `DRAFT`     | Gray  | Brouillon |
| `PUBLISHED` | Green | Publie    |
| `ARCHIVED`  | Amber | Archive   |

---

### 4.4 Availability Configuration

**Purpose:** Weekly schedule builder (part of experience edit page)

```
+-----------------------------------------+
|                                         |
| [cal] DISPONIBILITES HEBDOMADAIRES      |
|                                         |
| +-------------------------------------+ |
| | [!] Configurez au moins un creneau  | |
| |    pour permettre les reservations  | |
| +-------------------------------------+ |
|                                         |
| +-------------------------------------+ |
| | Lundi                          [+]  | |
| | - Aucun creneau                     | |
| +-------------------------------------+ |
| | Mardi                          [+]  | |
| | - Aucun creneau                     | |
| +-------------------------------------+ |
| | Mercredi                       [+]  | |
| | - Aucun creneau                     | |
| +-------------------------------------+ |
| | Jeudi                          [+]  | |
| | - Aucun creneau                     | |
| +-------------------------------------+ |
| | Vendredi                       [+]  | |
| | - [ok] 10:00 - 11:30       [ed][x]  | |
| | - [ok] 14:00 - 15:30       [ed][x]  | |
| +-------------------------------------+ |
| | Samedi                         [+]  | |
| | - [ok] 10:00 - 11:30       [ed][x]  | |
| | - [ok] 14:00 - 15:30       [ed][x]  | |
| | - [ok] 16:00 - 17:30       [ed][x]  | |
| +-------------------------------------+ |
| | Dimanche                       [+]  | |
| | - [ ] 10:00 - 11:30 (off)  [ed][x]  | |
| +-------------------------------------+ |
|                                         |
| +-------------------------------------+ |
| | [sync] Copier vers tous les jours   | |
| +-------------------------------------+ |
|                                         |
+-----------------------------------------+
|                                         |
| [cal] APERCU SEMAINE TYPE               |
|                                         |
| +-------------------------------------+ |
| |     Lu  Ma  Me  Je  Ve  Sa  Di      | |
| | 08  .   .   .   .   .   .   .       | |
| | 10  .   .   .   .   #   #   o       | |
| | 12  .   .   .   .   .   .   .       | |
| | 14  .   .   .   .   #   #   .       | |
| | 16  .   .   .   .   .   #   .       | |
| | 18  .   .   .   .   .   .   .       | |
| |                                     | |
| | # Actif  o Desactive                | |
| +-------------------------------------+ |
|                                         |
+-----------------------------------------+
```

---

### 4.5 Experience Search (`/experiences`)

**Purpose:** Search and filter experiences with results

```
+-----------------------------------------+
| [wine] EnCave        FR|DE    Connexion |
+-----------------------------------------+
|                                         |
| [search] Rechercher une experience      |
| +-------------------------------------+ |
| | Degustation, visite, atelier...     | |
| +-------------------------------------+ |
|                                         |
+-----------------------------------------+
| +-------------------------------------+ |
| | [pin] Commune | [wne] Type | Prix   | |
| | [Toutes   v]  | [Tous v]   |[0-200] | |
| +-------------------------------------+ |
|                                         |
| 12 experiences - Trier: [Pertinence v]  |
|                                         |
+-----------------------------------------+
|                                         |
| +--------+ +--------+ +--------+        |
| |[img]   | |[img]   | |[img]   |        |
| |        | |        | |        |        |
| |TASTING | |VISITE  | |ATELIER |        |
| |        | |        | |        |        |
| |Decouv. | |Cave    | |Assem-  |        |
| |des Crus| |histor. | |blage   |        |
| |        | |        | |        |        |
| |Cave du | |Domaine | |Vignoble|        |
| |Rhodan  | |Muses   | |Soleil  |        |
| |Salque. | | Fully  | |Sierre  |        |
| |        | |        | |        |        |
| |CHF 45  | |CHF 35  | |CHF 120 |        |
| |90min   | |60min   | |3h      |        |
| +--------+ +--------+ +--------+        |
|                                         |
| +--------+ +--------+ +--------+        |
| |...     | |...     | |...     |        |
| +--------+ +--------+ +--------+        |
|                                         |
|    [Charger plus d'experiences]         |
|                                         |
+-----------------------------------------+
```

**URL Query Parameters:**

```
/experiences?q=degustation&types=TASTING,CELLAR_VISIT&commune=Sion&priceMin=20&priceMax=80&sort=price_asc
```

---

### 4.6 Experience Detail (`/experiences/[slug]`)

**Purpose:** Full experience details with booking CTA

```
+-----------------------------------------+
| [wine] EnCave        FR|DE    Connexion |
+-----------------------------------------+
| Accueil > Experiences > Decouverte...   |
+-----------------------------------------+
| +-------------------------------------+ |
| |                                     | |
| |     [HERO IMAGE - FULL WIDTH]       | |
| |                                     | |
| |                            o o . .  | |
| +-------------------------------------+ |
|                                         |
| +--------+                              |
| |TASTING |                   CHF 45     |
| +--------+                   /personne  |
|                                         |
| Decouverte des Crus du Valais           |
| ==================================      |
|                                         |
| [clock] 90 min  -  [users] 2-8 pers.    |
|                                         |
+-----------------------------------------+
|                                         |
| A propos                                |
| --------                                |
|                                         |
| Plongez dans l'univers des vins         |
| valaisans avec notre degustation        |
| guidee. Vous decouvrirez 5 cepages      |
| emblematiques du Valais...              |
|                                         |
| - Fendant du Valais                     |
| - Petite Arvine                         |
| - Johannisberg                          |
| - Cornalin                              |
| - Humagne Rouge                         |
|                                         |
+-----------------------------------------+
|                                         |
| [cal] Disponibilites                    |
| --------------------                    |
|                                         |
| +-------------------------------------+ |
| | Vendredi    10:00, 14:00            | |
| | Samedi      10:00, 14:00, 16:00     | |
| | Dimanche    10:00                   | |
| +-------------------------------------+ |
|                                         |
+-----------------------------------------+
|                                         |
| [bld] La cave                           |
| ------------                            |
|                                         |
| +-------------------------------------+ |
| | +---+                               | |
| | |img| Cave du Rhodan                | |
| | +---+ [pin] Salquenen               | |
| |         [Voir la cave ->]           | |
| +-------------------------------------+ |
|                                         |
+-----------------------------------------+
|                                         |
| [i] Conditions                          |
| --------------                          |
|                                         |
| - Annulation gratuite jusqu'a 24h       |
|   avant l'experience                    |
| - Paiement securise par carte           |
| - Confirmation immediate par email      |
|                                         |
+-----------------------------------------+
| +-------------------------------------+ |
| |      [wine]  RESERVER MAINTENANT    | |
| |         a partir de CHF 45          | |
| +-------------------------------------+ |
|           Sticky bottom CTA             |
+-----------------------------------------+
```

---

## 5. Epic 3: Booking & Payments

### 5.1 Stripe Connect Status (Dashboard Component)

**Purpose:** Guide winemakers through Stripe onboarding

**State: Not Connected**

```
+-------------------------------------+
| [!] CONFIGURATION REQUISE           |
|                                     |
| Connectez votre compte bancaire     |
| pour recevoir vos paiements.        |
|                                     |
| +-------------------------------+   |
| | [card] CONFIGURER LES PAIEMENTS|  |
| +-------------------------------+   |
|                                     |
| [i] Sans configuration, vous ne     |
|    pourrez pas publier vos          |
|    experiences.                     |
+-------------------------------------+
```

**State: Pending Verification**

```
+-------------------------------------+
| [yellow] VERIFICATION EN COURS      |
|                                     |
| Stripe verifie vos informations.    |
| Cela peut prendre 1-2 jours.        |
|                                     |
| +-------------------------------+   |
| |  Voir le statut sur Stripe -> |   |
| +-------------------------------+   |
+-------------------------------------+
```

**State: Ready**

```
+-------------------------------------+
| [green] Paiements actives           |
|                                     |
| Vous pouvez recevoir des            |
| reservations.                       |
|                                     |
| [Gerer sur Stripe ->]               |
+-------------------------------------+
```

---

### 5.2 Booking Modal

**Purpose:** Quick date/time/guest selection with availability

```
+-----------------------------------------+
|               Reservation         X     |
+-----------------------------------------+
|                                         |
| [cal] Choisir une date                  |
| +-------------------------------------+ |
| |      <  Janvier 2026  >             | |
| |  Lu  Ma  Me  Je  Ve  Sa  Di         | |
| |          1   2   3  [4]  5          | |
| |   6   7   8   9  10 [11] 12         | |
| |  13  14  15  16  17 [18] 19         | |
| |  20  21  ##  ##  ## [25] 26         | |
| |  27  28  29  30  31                 | |
| |                                     | |
| |  [#] Dates disponibles              | |
| |  [X] Complet                        | |
| +-------------------------------------+ |
|                                         |
| [clock] Choisir un horaire              |
| +-------+ +-------+ +-------+           |
| | 10:00 | |>14:00<| | 16:30 |           |
| |4 plcs | |2 plcs | |6 plcs |           |
| +-------+ +-------+ +-------+           |
|                                         |
| [users] Nombre de personnes             |
| +-------------------------------------+ |
| |    [ - ]    2 personnes    [ + ]    | |
| +-------------------------------------+ |
| Capacite: 2-8 personnes                 |
|                                         |
+-----------------------------------------+
| +-------------------------------------+ |
| | Recapitulatif                       | |
| | Sam 11 janvier - 14:00 - 2 pers.    | |
| |                                     | |
| | CHF 45 x 2 personnes                | |
| | -----------------------------------  | |
| | Total:              CHF 90          | |
| +-------------------------------------+ |
|                                         |
| +-------------------------------------+ |
| |     CONTINUER VERS LE PAIEMENT ->   | |
| +-------------------------------------+ |
+-----------------------------------------+
```

---

### 5.3 Checkout & Payment (`/checkout`)

**Purpose:** Capture contact info, process payment

```
+-----------------------------------------+
| <- Modifier la selection     Paiement   |
+-----------------------------------------+
|                                         |
| +-------------------------------------+ |
| | [wine] Decouverte des Crus du Valais| |
| | Cave du Rhodan, Salquenen           | |
| | Sam 11 janvier - 14:00 - 2 pers.    | |
| +-------------------------------------+ |
|                                         |
| Vos coordonnees                         |
| +-------------------------------------+ |
| | Prenom *                            | |
| | [Marie                            ] | |
| +-------------------------------------+ |
| | Nom *                               | |
| | [Dupont                           ] | |
| +-------------------------------------+ |
| | Email *                             | |
| | [marie.dupont@email.com           ] | |
| +-------------------------------------+ |
| | Telephone *                         | |
| | [+41 79 123 45 67                 ] | |
| +-------------------------------------+ |
|                                         |
| Notes pour le vigneron (optionnel)      |
| +-------------------------------------+ |
| | [Nous fetons un anniversaire...   ] | |
| +-------------------------------------+ |
|                                         |
| +-------------------------------------+ |
| | [card] Paiement securise par Stripe | |
| |                                     | |
| | Numero de carte                     | |
| | [4242 4242 4242 4242            ]   | |
| |                                     | |
| | [MM/AA    ]    [CVC   ]             | |
| +-------------------------------------+ |
|                                         |
+-----------------------------------------+
| 2 x CHF 45                     CHF 90   |
| ---------------------------------------  |
| Total a payer                  CHF 90   |
|                                         |
| +-------------------------------------+ |
| |        [card] PAYER CHF 90          | |
| +-------------------------------------+ |
|                                         |
| [lock] Paiement securise - Annulation   |
|    gratuite jusqu'a 24h avant           |
+-----------------------------------------+
```

---

### 5.4 Booking Confirmation (`/booking/[id]/confirmation`)

**Purpose:** Celebrate success, provide all needed info

```
+-----------------------------------------+
|                                         |
|              [check]                    |
|           +-------+                     |
|           | [wine]|                     |
|           +-------+                     |
|                                         |
|     Reservation confirmee !             |
|                                         |
|     Reference: ENC-X7K9M2               |
|                                         |
+-----------------------------------------+
|                                         |
| Decouverte des Crus du Valais           |
|                                         |
| [cal]  Samedi 11 janvier 2026           |
| [clk]  14:00 - 15:30                    |
| [usr]  2 personnes                      |
| [mny]  CHF 90 (paye)                    |
|                                         |
| [pin] Cave du Rhodan                    |
|    Route du Village 12                  |
|    3970 Salquenen                       |
|    [Voir sur Google Maps ->]            |
|                                         |
+-----------------------------------------+
|                                         |
| +-------------------------------------+ |
| | [cal]  Ajouter au calendrier        | |
| |     Google - Apple - Outlook        | |
| +-------------------------------------+ |
|                                         |
| +-------------------------------------+ |
| | [mail]  Un email de confirmation    | |
| |    a ete envoye a marie@email.com   | |
| +-------------------------------------+ |
|                                         |
| [phone] Questions? Contactez:           |
|    +41 27 456 78 90                     |
|                                         |
+-----------------------------------------+
|                                         |
| +-------------------------------------+ |
| |   Decouvrir d'autres experiences    | |
| +-------------------------------------+ |
|                                         |
+-----------------------------------------+
```

---

### 5.5 Client Booking View (`/booking/[id]`)

**Purpose:** Client can view and manage their booking

```
+-----------------------------------------+
| [wine] EnCave        FR|DE    Connexion |
+-----------------------------------------+
|                                         |
| Ma reservation                          |
| ==============                          |
|                                         |
| Reference: ENC-X7K9M2                   |
|                                         |
+-----------------------------------------+
|                                         |
| +-------------------------------------+ |
| | +----------+                        | |
| | |[grn]CONF.|                        | |
| | +----------+                        | |
| |                                     | |
| | [wine] Decouverte des Crus du Valais| |
| |    Cave du Rhodan                   | |
| |                                     | |
| | [cal] Samedi 11 janvier 2026        | |
| | [clk] 14:00 - 15:30                 | |
| | [usr] 2 personnes                   | |
| | [mny] CHF 90 (paye)                 | |
| +-------------------------------------+ |
|                                         |
+-----------------------------------------+
|                                         |
| [pin] Adresse                           |
| ----------                              |
|                                         |
| Cave du Rhodan                          |
| Route du Village 12                     |
| 3970 Salquenen                          |
|                                         |
| [Voir sur Google Maps]                  |
|                                         |
+-----------------------------------------+
|                                         |
| [phone] Contact                         |
| ----------                              |
|                                         |
| +41 27 456 78 90                        |
| contact@cave-rhodan.ch                  |
|                                         |
+-----------------------------------------+
|                                         |
| [cal] Ajouter au calendrier             |
| -------------------------               |
|                                         |
| [Google] [Apple] [Outlook] [.ics]       |
|                                         |
+-----------------------------------------+
|                                         |
| [i] Conditions d'annulation             |
| --------------------------              |
|                                         |
| - Annulation gratuite jusqu'au          |
|   10 janvier 2026 a 14:00               |
| - Apres cette date, aucun               |
|   remboursement possible                |
|                                         |
| +-------------------------------------+ |
| |     [X] ANNULER LA RESERVATION      | |
| +-------------------------------------+ |
|                                         |
+-----------------------------------------+
```

---

### 5.6 Cancellation Modal

**Purpose:** Confirm cancellation with policy

**More than 24h before (Full Refund):**

```
+-----------------------------------------+
|                                         |
|     Annuler la reservation?        X    |
|                                         |
+-----------------------------------------+
|                                         |
| [wine] Decouverte des Crus du Valais    |
| [cal] Samedi 11 janvier 2026 a 14:00    |
|                                         |
| +-------------------------------------+ |
| | [green] REMBOURSEMENT TOTAL         | |
| |                                     | |
| | Vous annulez plus de 24h avant      | |
| | l'experience.                       | |
| |                                     | |
| | Montant rembourse: CHF 90           | |
| |                                     | |
| | Le remboursement sera credite       | |
| | sous 5-10 jours ouvres.             | |
| +-------------------------------------+ |
|                                         |
| [x] Je comprends que cette action est   |
|    irreversible                         |
|                                         |
+-----------------------------------------+
|                                         |
|  +---------+   +--------------------+   |
|  | Retour  |   | CONFIRMER          |   |
|  |         |   | L'ANNULATION       |   |
|  +---------+   +--------------------+   |
|                                         |
+-----------------------------------------+
```

**Less than 24h before (No Refund):**

```
+-----------------------------------------+
| +-------------------------------------+ |
| | [orange] AUCUN REMBOURSEMENT        | |
| |                                     | |
| | Vous annulez moins de 24h avant     | |
| | l'experience.                       | |
| |                                     | |
| | [clk] Delai depasse depuis 3h       | |
| |                                     | |
| | Conformement a nos conditions,      | |
| | aucun remboursement ne sera         | |
| | effectue.                           | |
| +-------------------------------------+ |
+-----------------------------------------+
```

---

## 6. Epic 4: Operations & Launch

### 6.1 Winemaker Dashboard Home (`/dashboard`)

**Purpose:** Overview with key metrics and quick actions

```
+-----------------------------------------+
| [menu] EnCave Dashboard    Marie D. v   |
+-----------------------------------------+
|>Accueil<| Profil | Exper. | Reserv.     |
+-----------------------------------------+
|                                         |
| Bonjour, Marie!                         |
| Cave du Rhodan                          |
|                                         |
| +-------------------------------------+ |
| | [green] Paiements actives  [Gerer]  | |
| +-------------------------------------+ |
|                                         |
+-----------------------------------------+
|                                         |
| [chart] Aujourd'hui                     |
|                                         |
| +-------+ +-------+ +-------+           |
| |   2   | |   6   | |  CHF  |           |
| |       | |       | |  270  |           |
| |Reserv.| |Visitrs| |Revenus|           |
| +-------+ +-------+ +-------+           |
|                                         |
+-----------------------------------------+
|                                         |
| [cal] Prochaines reservations           |
|                                         |
| +-------------------------------------+ |
| | AUJOURD'HUI                         | |
| |                                     | |
| | 14:00 - Decouverte des Crus         | |
| | [usr] Jean Dupont - 4 pers.         | |
| |                                     | |
| | 16:00 - Visite de Cave              | |
| | [usr] Anna Schmidt - 2 pers.        | |
| +-------------------------------------+ |
| | DEMAIN                              | |
| |                                     | |
| | 10:00 - Decouverte des Crus         | |
| | [usr] Pierre Martin - 6 pers.       | |
| +-------------------------------------+ |
|                                         |
| [Voir toutes les reservations ->]       |
|                                         |
+-----------------------------------------+
|                                         |
| [rocket] Actions rapides                |
|                                         |
| +---------------+ +---------------+     |
| | + Nouvelle    | | [cal] Bloquer |     |
| |   experience  | |    une date   |     |
| +---------------+ +---------------+     |
|                                         |
+-----------------------------------------+
```

---

### 6.2 Bookings List (`/dashboard/bookings`)

**Purpose:** Manage all reservations with filters and actions

```
+-----------------------------------------+
| [menu] EnCave Dashboard    Marie D. v   |
+-----------------------------------------+
| Accueil | Profil | Exper. |>Reserv.<    |
+-----------------------------------------+
|                                         |
| Reservations                            |
| ============                            |
|                                         |
| +-------------------------------------+ |
| | [[list] Liste] [[cal] Calendrier]   | |
| +-------------------------------------+ |
|                                         |
| +-------------------------------------+ |
| | [chart] Resume                      | |
| |                                     | |
| | Aujourd'hui  Cette sem.  Ce mois    | |
| |   2 (6)        8 (24)     23 (67)   | |
| |  reserv.      reserv.     reserv.   | |
| +-------------------------------------+ |
|                                         |
+-----------------------------------------+
|                                         |
| +-------------------------------------+ |
| |[s] Rechercher client ou reference...| |
| +-------------------------------------+ |
|                                         |
| Filtres: [Statut v] [Experience v]      |
|          [Date du v] [au v]             |
|                                         |
| 23 reservations - Trier: [Date v]       |
|                                         |
+-----------------------------------------+
|                                         |
| +-------------------------------------+ |
| | [cal] Aujourd'hui - Sam 11 jan      | |
| +-------------------------------------+ |
| |                                     | |
| | 14:00 - Decouverte des Crus         | |
| | +----------+                        | |
| | |[grn]CONF.|  Jean Dupont           | |
| | +----------+  [usr] 4 - CHF 180     | |
| |                              [v]    | |
| + - - - - - - - - - - - - - - - - - - + |
| | [mail] jean.dupont@email.com        | |
| | [phone] +41 79 123 45 67            | |
| | [doc] "C'est pour un anniversaire"  | |
| |                                     | |
| | [[ok] Termine] [[x] No-show]  [:]   | |
| +-------------------------------------+ |
|                                         |
| +-------------------------------------+ |
| | 16:00 - Visite de Cave              | |
| | +----------+                        | |
| | |[grn]CONF.|  Anna Schmidt          | |
| | +----------+  [usr] 2 - CHF 70      | |
| |                              [>]    | |
| +-------------------------------------+ |
|                                         |
|        [Exporter en CSV]                |
|                                         |
+-----------------------------------------+
```

**Status Badges:**

| Status                | Color | Label FR        |
| --------------------- | ----- | --------------- |
| `CONFIRMED`           | Green | Confirme        |
| `COMPLETED`           | Blue  | Termine         |
| `CANCELLED_BY_CLIENT` | Gray  | Annule (client) |
| `CANCELLED_BY_WINERY` | Gray  | Annule (vous)   |
| `NO_SHOW`             | Red   | No-show         |

---

### 6.3 Calendar View (`/dashboard/bookings?view=calendar`)

**Purpose:** Visual calendar of bookings

```
+-----------------------------------------+
| [menu] EnCave Dashboard    Marie D. v   |
+-----------------------------------------+
| Accueil | Profil | Exper. |>Reserv.<    |
+-----------------------------------------+
|                                         |
| Reservations                            |
| ============                            |
|                                         |
| +-------------------------------------+ |
| | [[list] Liste] [>[cal] Calendrier<] | |
| +-------------------------------------+ |
|                                         |
+-----------------------------------------+
|                                         |
| +-------------------------------------+ |
| | <   Janvier 2026   >   [Aujourd'hui]| |
| +-------------------------------------+ |
| | Lu   Ma   Me   Je   Ve   Sa   Di    | |
| +-------------------------------------+ |
| |                 1    2    3    4    | |
| |                      o         oo   | |
| |                     (2)       (4)   | |
| +-------------------------------------+ |
| |  5    6    7    8    9   10  [11]   | |
| |                      o    o    oo   | |
| |                     (2)  (2)  (6)   | |
| +-------------------------------------+ |
| | 12   13   14   15   16   17   18    | |
| |  o                        oo   o    | |
| | (6)                      (4)  (2)   | |
| +-------------------------------------+ |
|                                         |
| o Degustation  o Visite  o Atelier      |
| (n) = nombre de visiteurs               |
|                                         |
+-----------------------------------------+
|                                         |
| [cal] Samedi 11 janvier (Aujourd'hui)   |
| -------------------------------------   |
|                                         |
| +-------------------------------------+ |
| | 14:00 - 15:30                       | |
| | [wine] Decouverte des Crus          | |
| | Jean Dupont - 4 pers. - CHF 180     | |
| | +----------+                        | |
| | |[grn]CONF.|            [Voir ->]   | |
| | +----------+                        | |
| +-------------------------------------+ |
|                                         |
| +-------------------------------------+ |
| | 16:00 - 17:00                       | |
| | [bld] Visite de Cave                | |
| | Anna Schmidt - 2 pers. - CHF 70     | |
| | +----------+                        | |
| | |[grn]CONF.|            [Voir ->]   | |
| | +----------+                        | |
| +-------------------------------------+ |
|                                         |
| +-------------------------------------+ |
| |     [X] Bloquer cette journee       | |
| +-------------------------------------+ |
|                                         |
+-----------------------------------------+
```

---

### 6.4 Earnings Page (`/dashboard/earnings`)

**Purpose:** Track revenue and payouts

```
+-----------------------------------------+
| [menu] EnCave Dashboard    Marie D. v   |
+-----------------------------------------+
| Accueil | Profil | Exper. | Reserv.     |
|                           |>Revenus<    |
+-----------------------------------------+
|                                         |
| Revenus                                 |
| =======                                 |
|                                         |
| +-------+ +-------+ +-------+           |
| |CHF8.4k| |CHF2.1k| |CHF 850|           |
| |       | |       | |       |           |
| |Total  | |Ce mois| |Prochain|          |
| |2026   | |       | |versemt|           |
| +-------+ +-------+ +-------+           |
|                                         |
| Prochain versement: ~15 janvier         |
|                                         |
+-----------------------------------------+
|                                         |
| [chart] Evolution des revenus           |
|                                         |
| +-------------------------------------+ |
|  CHF                                    |
| 3000 |                                  |
|      |          ####                    |
| 2000 |    ####  ####  ####              |
|      |    ####  ####  ####  oooo        |
| 1000 |    ####  ####  ####  ####        |
|      |    ####  ####  ####  ####        |
|    0 +------------------------------    |
|        Sept   Oct   Nov   Dec   Jan     |
|                                         |
|  # Brut   o Net (apres commission)      |
| +-------------------------------------+ |
|                                         |
+-----------------------------------------+
|                                         |
| [money] Transactions                    |
|                                         |
| Filtrer: [Mois v] [Experience v]        |
|          [Statut v]                     |
|                                         |
| +-------------------------------------+ |
| | 11 jan - Decouverte des Crus        | |
| | Jean Dupont - 4 pers.               | |
| |                                     | |
| | Brut:        CHF 180.00             | |
| | Commission:  CHF  21.60 (12%)       | |
| | ---------------------------------   | |
| | Net:         CHF 158.40             | |
| |                                     | |
| | +------------+                      | |
| | |[yel]EN CRS |  Versement ~18 jan   | |
| | +------------+                      | |
| +-------------------------------------+ |
|                                         |
| +-------------------------------------+ |
| | 10 jan - Visite de Cave             | |
| | Sophie Weber - 2 pers.              | |
| |                                     | |
| | Brut:        CHF  70.00             | |
| | Commission:  CHF   8.40 (12%)       | |
| | ---------------------------------   | |
| | Net:         CHF  61.60             | |
| |                                     | |
| | +------------+                      | |
| | |[grn] VERSE |  Verse le 17 jan     | |
| | +------------+                      | |
| +-------------------------------------+ |
|                                         |
+-----------------------------------------+
|                                         |
| [[doc] Telecharger le releve 2026 (PDF)]|
|                                         |
| [[card] Gerer sur Stripe ->]            |
|                                         |
+-----------------------------------------+
```

---

### 6.5 Notification Settings (`/dashboard/settings/notifications`)

**Purpose:** Manage email notification preferences

```
+-----------------------------------------+
| [menu] EnCave Dashboard    Marie D. v   |
+-----------------------------------------+
| Accueil | Profil | Exper. | Reserv.     |
|         |>Param.<|                      |
+-----------------------------------------+
|                                         |
| <- Parametres                           |
|                                         |
| Notifications                           |
| =============                           |
|                                         |
| Gerez les emails que vous recevez.      |
|                                         |
+-----------------------------------------+
|                                         |
| [mail] RESERVATIONS                     |
| (Notifications transactionnelles)       |
|                                         |
| +-------------------------------------+ |
| | Nouvelle reservation          [ON ] | |
| | Email immediat quand un client      | |
| | reserve une experience.             | |
| | [!] Ne peut pas etre desactive      | |
| +-------------------------------------+ |
|                                         |
| +-------------------------------------+ |
| | Annulation                    [ON ] | |
| | Email quand un client annule        | |
| | sa reservation.                     | |
| | [!] Ne peut pas etre desactive      | |
| +-------------------------------------+ |
|                                         |
+-----------------------------------------+
|                                         |
| [cal] RAPPELS                           |
|                                         |
| +-------------------------------------+ |
| | Resume quotidien              [ON ] | |
| | Recapitulatif des reservations      | |
| | du jour, chaque matin.              | |
| |                                     | |
| | Horaire: [7:00 v]                   | |
| +-------------------------------------+ |
|                                         |
| +-------------------------------------+ |
| | Resume hebdomadaire           [OFF] | |
| | Bilan de la semaine passee et       | |
| | apercu de la semaine a venir.       | |
| | Envoye le lundi matin.              | |
| +-------------------------------------+ |
|                                         |
+-----------------------------------------+
|                                         |
| [money] PAIEMENTS                       |
|                                         |
| +-------------------------------------+ |
| | Versement effectue            [ON ] | |
| | Notification quand un versement     | |
| | est envoye sur votre compte.        | |
| +-------------------------------------+ |
|                                         |
+-----------------------------------------+
|                                         |
| +-------------------------------------+ |
| |         ENREGISTRER                 | |
| +-------------------------------------+ |
|                                         |
+-----------------------------------------+
```

---

### 6.6 404 Page

**Purpose:** Friendly not found page

```
+-----------------------------------------+
| [wine] EnCave        FR|DE    Connexion |
+-----------------------------------------+
|                                         |
|                                         |
|              [wine]                     |
|                                         |
|              404                        |
|                                         |
|     Page introuvable                    |
|                                         |
|   La page que vous cherchez n'existe    |
|   pas ou a ete deplacee.                |
|                                         |
|                                         |
|   +-------------------------------+     |
|   | [s] Rechercher une experience |     |
|   +-------------------------------+     |
|                                         |
|              ou                         |
|                                         |
|   +-------------------------------+     |
|   |     Retour a l'accueil        |     |
|   +-------------------------------+     |
|                                         |
|                                         |
|   Experiences populaires:               |
|                                         |
|   - Decouverte des Crus du Valais       |
|   - Visite de Cave Historique           |
|   - Atelier Assemblage                  |
|                                         |
|                                         |
+-----------------------------------------+
```

---

### 6.7 500 Page

**Purpose:** Server error page

```
+-----------------------------------------+
| [wine] EnCave        FR|DE    Connexion |
+-----------------------------------------+
|                                         |
|                                         |
|              [!]                        |
|                                         |
|         Oups!                           |
|                                         |
|   Une erreur est survenue               |
|                                         |
|   Nous sommes desoles, quelque chose    |
|   s'est mal passe de notre cote.        |
|                                         |
|   Notre equipe a ete notifiee.          |
|                                         |
|                                         |
|   +-------------------------------+     |
|   |       Reessayer               |     |
|   +-------------------------------+     |
|                                         |
|   +-------------------------------+     |
|   |     Retour a l'accueil        |     |
|   +-------------------------------+     |
|                                         |
|                                         |
|   Si le probleme persiste:              |
|   [mail] support@encave.ch              |
|                                         |
|                                         |
+-----------------------------------------+
```

---

### 6.8 Language Switcher Component

**Purpose:** Toggle between French and German

```
Header Integration:
+-----------------------------------------+
| [wine] EnCave            [FR|DE]  Login |
+-----------------------------------------+

Clicked state:
+-----------------------------------------+
| [wine] EnCave            +------+ Login |
|                          |> FR <|       |
|                          |  DE  |       |
|                          +------+       |
+-----------------------------------------+
```

**Component:**

```typescript
interface LanguageSwitcherProps {
  currentLocale: 'fr' | 'de';
  availableLocales: Array<{
    code: 'fr' | 'de';
    label: string;
  }>;
}
```

---

## 7. Component Specifications

### 7.1 Complete Component Hierarchy

```
App/
├── Layout/
│   ├── Header
│   ├── Footer
│   └── LanguageSwitcher
├── Auth/
│   ├── LoginForm
│   ├── RegisterForm
│   ├── PasswordInput
│   └── SocialLoginButton
├── Onboarding/
│   ├── WineryOnboardingForm
│   ├── CommuneSelect
│   └── OnboardingConfirmation
├── Dashboard/
│   ├── DashboardLayout
│   ├── DashboardNav
│   ├── StripeConnectStatus
│   ├── StatsCards
│   ├── UpcomingBookings
│   └── QuickActions
├── Winery/
│   ├── WineryCard
│   ├── WineryDetail
│   ├── WineryProfileForm
│   ├── ImageUpload
│   └── GalleryUpload
├── Experience/
│   ├── ExperienceCard
│   ├── ExperienceDetail
│   ├── ExperienceForm
│   ├── ExperienceListItem
│   ├── TypeBadge
│   ├── AvailabilityConfig
│   └── WeekPreview
├── Search/
│   ├── HeroSearch
│   ├── SearchFilters
│   ├── FilterPanel
│   ├── ExperienceGrid
│   └── TypeCards
├── Booking/
│   ├── BookNowCTA
│   ├── BookingModal
│   ├── DatePicker
│   ├── TimeSlotPicker
│   ├── GuestCounter
│   ├── BookingSummary
│   ├── CheckoutForm
│   ├── ContactForm
│   ├── PayButton
│   ├── BookingConfirmation
│   ├── BookingDetail
│   └── CancellationModal
├── Bookings/
│   ├── BookingsList
│   ├── BookingRow
│   ├── BookingsCalendar
│   ├── CalendarDay
│   └── StatusBadge
├── Earnings/
│   ├── EarningsSummary
│   ├── EarningsChart
│   ├── TransactionList
│   └── TransactionRow
├── Admin/
│   ├── AdminLayout
│   ├── AdminSidebar
│   ├── PendingWineryCard
│   ├── WineryReview
│   └── ApprovalDialog
├── Settings/
│   ├── NotificationSettings
│   └── ToggleSwitch
├── Common/
│   ├── Button
│   ├── Input
│   ├── Select
│   ├── Textarea
│   ├── Card
│   ├── Modal
│   ├── Sheet
│   ├── Toast
│   ├── Skeleton
│   ├── Spinner
│   └── EmptyState
└── Error/
    ├── NotFound
    └── ServerError
```

### 7.2 Key Component Interfaces

```typescript
// Booking Flow
interface BookNowCTAProps {
  price: number;
  currency: 'CHF';
  isAvailable: boolean;
  isLoading?: boolean;
  onClick: () => void;
  locale: 'fr' | 'de';
}

interface DatePickerProps {
  experienceId: string;
  availableDates: Date[];
  fullyBookedDates: Date[];
  selectedDate: Date | null;
  onDateSelect: (date: Date) => void;
  locale: 'fr' | 'de';
}

interface TimeSlotPickerProps {
  slots: TimeSlot[];
  selectedSlot: string | null;
  onSlotSelect: (slot: string) => void;
  locale: 'fr' | 'de';
}

interface GuestCounterProps {
  value: number;
  min: number;
  max: number;
  remainingCapacity: number;
  onChange: (count: number) => void;
  locale: 'fr' | 'de';
}

interface ContactFormProps {
  initialValues?: ContactInfo;
  onSubmit: (data: ContactInfo) => void;
  isSubmitting: boolean;
  errors?: Record<string, string>;
  locale: 'fr' | 'de';
}

interface PayButtonProps {
  amount: number;
  currency: 'CHF';
  isValid: boolean;
  isProcessing: boolean;
  onClick: () => void;
  locale: 'fr' | 'de';
}

// Dashboard
interface BookingsListProps {
  bookings: WineryBooking[];
  summary: BookingSummary;
  filters: BookingFilters;
  onFilterChange: (filters: BookingFilters) => void;
  onAction: (id: string, action: BookingAction) => void;
  locale: 'fr' | 'de';
}

interface EarningsPageProps {
  summary: EarningsSummary;
  chartData: MonthlyEarnings[];
  transactions: Transaction[];
  stripeLoginUrl: string;
  locale: 'fr' | 'de';
}

// Search
interface ExperienceSearchProps {
  initialFilters?: SearchFilters;
  locale: 'fr' | 'de';
}

interface FilterPanelProps {
  filters: SearchFilters;
  onChange: (filters: SearchFilters) => void;
  communes: string[];
  resultCount: number;
  locale: 'fr' | 'de';
}
```

---

## 8. Design Tokens

### 8.1 Colors

```css
:root {
  /* Primary - Burgundy */
  --color-burgundy-50: #fdf2f4;
  --color-burgundy-100: #fce7ea;
  --color-burgundy-200: #f9d0d6;
  --color-burgundy-300: #f4a9b5;
  --color-burgundy-400: #ec7a8e;
  --color-burgundy-500: #e04d6a;
  --color-burgundy-600: #722f37; /* Primary */
  --color-burgundy-700: #5c262d;
  --color-burgundy-800: #4a1f25;
  --color-burgundy-900: #3d1a1f;

  /* Accent - Gold */
  --color-gold-500: #d4af37;
  --color-gold-600: #b8972e;

  /* Semantic */
  --color-success: #059669;
  --color-warning: #d97706;
  --color-error: #dc2626;

  /* Neutral */
  --color-gray-50: #f9fafb;
  --color-gray-100: #f3f4f6;
  --color-gray-200: #e5e7eb;
  --color-gray-300: #d1d5db;
  --color-gray-400: #9ca3af;
  --color-gray-500: #6b7280;
  --color-gray-600: #4b5563;
  --color-gray-700: #374151;
  --color-gray-800: #1f2937;
  --color-gray-900: #111827;
}
```

### 8.2 Typography

```css
:root {
  --font-heading: 'Playfair Display', Georgia, serif;
  --font-body: 'Inter', system-ui, sans-serif;

  /* Fluid typography */
  --text-page-title: clamp(1.5rem, 5vw, 2.25rem);
  --text-section-title: clamp(1.25rem, 4vw, 1.75rem);
  --text-card-title: clamp(1rem, 3vw, 1.25rem);
  --text-body: clamp(0.875rem, 2vw, 1rem);
  --text-caption: clamp(0.75rem, 1.5vw, 0.875rem);

  /* Fixed sizes */
  --text-xs: 0.75rem; /* 12px */
  --text-sm: 0.875rem; /* 14px */
  --text-base: 1rem; /* 16px */
  --text-lg: 1.125rem; /* 18px */
  --text-xl: 1.25rem; /* 20px */
  --text-2xl: 1.5rem; /* 24px */
  --text-3xl: 1.875rem; /* 30px */
}
```

### 8.3 Spacing

```css
:root {
  --space-1: 0.25rem; /* 4px */
  --space-2: 0.5rem; /* 8px */
  --space-3: 0.75rem; /* 12px */
  --space-4: 1rem; /* 16px */
  --space-5: 1.25rem; /* 20px */
  --space-6: 1.5rem; /* 24px */
  --space-8: 2rem; /* 32px */
  --space-10: 2.5rem; /* 40px */
  --space-12: 3rem; /* 48px */
}
```

### 8.4 Shadows

```css
:root {
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
  --shadow-sticky: 0 -4px 12px rgba(0, 0, 0, 0.1);
}
```

### 8.5 Border Radius

```css
:root {
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-2xl: 24px;
  --radius-full: 9999px;
}
```

---

## 9. Animation & Transitions

### 9.1 Timing Tokens

```css
:root {
  /* Durations */
  --duration-instant: 100ms;
  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --duration-slow: 350ms;
  --duration-slower: 500ms;

  /* Easing Functions */
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in: cubic-bezier(0.7, 0, 0.84, 0);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

### 9.2 Key Animations

```css
/* Modal slide up (mobile) */
@keyframes slide-up {
  from {
    transform: translateY(100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

/* Modal fade scale (desktop) */
@keyframes fade-scale-in {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

/* Skeleton shimmer */
@keyframes skeleton-shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

/* Toast enter */
@keyframes toast-enter {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

/* Spinner */
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Error shake */
@keyframes error-shake {
  0%,
  100% {
    transform: translateX(0);
  }
  20%,
  60% {
    transform: translateX(-4px);
  }
  40%,
  80% {
    transform: translateX(4px);
  }
}
```

### 9.3 Animation Summary

| Component  | Trigger      | Animation         | Duration | Easing      |
| ---------- | ------------ | ----------------- | -------- | ----------- |
| Modal      | open         | slide up / scale  | 350ms    | ease-out    |
| Modal      | close        | slide down / fade | 250ms    | ease-in     |
| Button     | hover        | scale(1.02)       | 150ms    | ease-out    |
| Button     | active       | scale(0.98)       | 100ms    | ease-out    |
| Toast      | enter        | slide from right  | 250ms    | ease-out    |
| Toast      | exit         | slide to right    | 150ms    | ease-in     |
| Skeleton   | continuous   | shimmer           | 1.5s     | ease-in-out |
| Spinner    | continuous   | rotate            | 1s       | linear      |
| Form error | trigger      | shake             | 250ms    | ease-out    |
| Calendar   | month change | slide             | 250ms    | ease-in-out |

### 9.4 Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

---

## 10. Responsive Breakpoints

### 10.1 Breakpoint System

```css
:root {
  --bp-xs: 320px; /* Small phones */
  --bp-sm: 480px; /* Large phones */
  --bp-md: 768px; /* Tablets */
  --bp-lg: 1024px; /* Small desktops */
  --bp-xl: 1280px; /* Large desktops */
}
```

### 10.2 Device Target Matrix

| Breakpoint | Width       | Target Devices           | Primary Use                 |
| ---------- | ----------- | ------------------------ | --------------------------- |
| **xs**     | 320-479px   | iPhone SE, small Android | Tourist browsing            |
| **sm**     | 480-767px   | iPhone Pro Max           | Tourist browsing            |
| **md**     | 768-1023px  | iPad, tablets            | Browsing + light management |
| **lg**     | 1024-1279px | Small laptops            | Winemaker dashboard         |
| **xl**     | 1280px+     | Desktops                 | Full dashboard              |

### 10.3 Layout Patterns

| Component       | Mobile        | Tablet           | Desktop         |
| --------------- | ------------- | ---------------- | --------------- |
| Homepage        | Single column | 2-col features   | 3-col features  |
| Experience grid | 1 column      | 2 columns        | 3 columns       |
| Winery grid     | 1 column      | 2 columns        | 3 columns       |
| Booking Modal   | Bottom sheet  | Centered (600px) | Wide (800px)    |
| Checkout        | Single column | 2-col form       | 2-col + sidebar |
| Dashboard       | Stacked tabs  | Side nav         | Side nav + wide |
| Calendar        | Month only    | Month + list     | Week view       |

### 10.4 Touch Targets

| Element       | Mobile  | Tablet  | Desktop |
| ------------- | ------- | ------- | ------- |
| Button height | 48px    | 44px    | 40px    |
| Input height  | 48px    | 44px    | 40px    |
| Icon button   | 44x44px | 40x40px | 36x36px |
| Calendar cell | 36x36px | 44x44px | 48x48px |

---

## 11. Accessibility Requirements

### 11.1 Standards

**Target: WCAG 2.1 AA Compliance**

### 11.2 Color Contrast

- Minimum 4.5:1 for body text
- Minimum 3:1 for large text (18px+)
- Minimum 3:1 for UI components and icons

### 11.3 Keyboard Navigation

- All interactive elements focusable
- Visible focus indicators (2px burgundy ring)
- Logical tab order
- Escape closes modals
- Arrow keys navigate calendar
- Enter/Space activate buttons

### 11.4 Screen Reader Support

- Semantic HTML elements
- ARIA labels on icon buttons
- Live regions for dynamic content
- Form error announcements
- Page titles describe content

### 11.5 Key ARIA Patterns

**DatePicker:**

```html
<div role="grid" aria-label="Janvier 2026">
  <button
    role="gridcell"
    aria-selected="true"
    aria-label="Samedi 11 janvier, disponible"
  ></button>
</div>
```

**GuestCounter:**

```html
<div
  role="spinbutton"
  aria-valuemin="2"
  aria-valuemax="8"
  aria-valuenow="4"
  aria-label="Nombre de personnes"
></div>
```

**Modal:**

```html
<div role="dialog" aria-modal="true" aria-labelledby="modal-title"></div>
```

**StatusBadge:**

```html
<span role="status" aria-label="Statut: Confirme"></span>
```

---

## 12. Email Templates

### 12.1 Client Confirmation Email

**Subject:** Reservation confirmee - [Experience] chez [Winery]

**Content Structure:**

1. Header with EnCave logo
2. Success message with booking reference
3. Booking details card (experience, date, time, guests, amount)
4. Location with Google Maps link
5. "Add to Calendar" buttons
6. What to expect / preparation tips
7. Cancellation policy reminder
8. Winery contact info
9. Footer with social links

### 12.2 Winemaker New Booking Email

**Subject:** Nouvelle reservation - [Experience] le [Date]

**Content Structure:**

1. Header with EnCave logo
2. "New booking" alert
3. Experience and datetime
4. Client info (name, email, phone)
5. Special requests/notes
6. Revenue breakdown (gross, commission, net)
7. "View in Dashboard" CTA
8. Footer

### 12.3 Client Reminder Email (24h before)

**Subject:** Rappel: [Experience] demain a [Time]

**Content Structure:**

1. Brief header
2. Experience name and datetime
3. Location with directions link
4. "Add to Calendar" link
5. Winery contact for questions
6. Compact footer

### 12.4 Winemaker Daily Digest

**Subject:** Vos reservations du [Date]

**Content Structure:**

1. Header with greeting
2. Today's bookings summary (count, total guests)
3. List of bookings with times, client names, guest counts
4. Tomorrow's preview
5. "View Calendar" CTA
6. Footer

---

## 13. Implementation Notes

### 13.1 Tech Stack Alignment

This spec is designed for:

- **Framework:** Next.js 14+ with App Router
- **Styling:** Tailwind CSS
- **Components:** shadcn/ui as base
- **State:** React Context + nuqs (URL state)
- **Forms:** React Hook Form + Zod
- **Payments:** Stripe Elements
- **i18n:** next-intl
- **Email:** React Email + Resend

### 13.2 shadcn/ui Component Mapping

| Spec Component         | shadcn/ui Base    |
| ---------------------- | ----------------- |
| BookNowCTA             | Button            |
| DatePicker             | Calendar          |
| TimeSlotPicker         | Card + RadioGroup |
| GuestCounter           | Button + custom   |
| BookingModal (mobile)  | Sheet             |
| BookingModal (desktop) | Dialog            |
| ContactForm inputs     | Input             |
| Select dropdowns       | Select            |
| Toast                  | Toast             |
| Skeleton               | Skeleton          |

### 13.3 i18n Considerations

- All UI text via next-intl
- Date formatting: `fr-CH` / `de-CH` locales
- Currency: Always CHF, consistent format
- Phone format: International with +41 default
- User content (descriptions) stays in original language

### 13.4 Performance Targets

| Metric | Target             |
| ------ | ------------------ |
| LCP    | < 2.5s             |
| FID    | < 100ms            |
| CLS    | < 0.1              |
| Bundle | < 200KB initial    |
| Images | WebP, lazy loaded  |
| Fonts  | Font-display: swap |

### 13.5 Testing Requirements

- Visual regression (Chromatic/Percy)
- Accessibility audits (axe-core)
- Mobile device testing (BrowserStack)
- E2E flows (Playwright)
- Unit tests (Vitest)

---

## Appendix: AI UI Generation Prompts

### Homepage + Search

```
Create a homepage for EnCave, a Swiss wine tourism platform.

BRAND:
- Colors: Burgundy (#722F37) primary, Gold (#D4AF37) accent
- Typography: Playfair Display headings, Inter body
- Feel: Premium yet approachable

SECTIONS:
1. Hero with vineyard background image
2. Search box (text, date picker, guest count)
3. Experience type cards (Tasting, Visit, Workshop, Tour)
4. Featured experiences carousel (3 cards)
5. Regional map with clickable communes
6. "How it works" 3-step section
7. Footer with links

Mobile-first, shadcn/ui, Tailwind CSS
```

### Winemaker Dashboard

```
Create a winemaker dashboard for EnCave wine booking platform.

BRAND:
- Colors: Burgundy (#722F37) primary
- Clean, functional design

SCREENS:
1. Dashboard home with stats cards, upcoming bookings
2. Bookings list with filters, expandable rows
3. Calendar view with month/week toggle
4. Earnings page with chart and transactions

REQUIREMENTS:
- Side navigation on desktop, bottom tabs on mobile
- Status badges (Confirmed, Completed, Cancelled)
- Export to CSV functionality
- shadcn/ui components, Tailwind CSS
```

### Booking Flow

```
Create a booking flow for EnCave wine experience platform.

BRAND:
- Colors: Burgundy (#722F37) primary, Gold (#D4AF37) accent

SCREENS:
1. Booking modal (bottom sheet mobile, dialog desktop)
   - Calendar with availability states
   - Time slot cards with capacity
   - Guest counter
   - Live price calculation

2. Checkout page
   - Booking summary
   - Contact form (name, email, phone)
   - Stripe payment element
   - Trust signals

3. Confirmation page
   - Success animation
   - Booking reference
   - Add to calendar buttons
   - Location with map

Mobile-first, WCAG AA, shadcn/ui, Tailwind
```

---

_Document generated 2026-01-07 | Sally, UX Expert_
_Version 2.0 - Complete specification for 30 screens across 4 epics_
