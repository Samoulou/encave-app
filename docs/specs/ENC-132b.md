# ENC-132b — Vérifier exhaustivité de la page mentions légales

## Objectif métier

S'assurer que la page `/legal` (mentions légales + CGU + CGV + politique de confidentialité) couvre **toutes les obligations légales suisses** : LCD (loi contre la concurrence déloyale, art. 3 al. 1 let. s — identification de l'éditeur en e-commerce), nLPD (information sur le traitement des données), droit de la consommation, droit comptable, politique alcool. Sans cette page robuste, la plateforme s'expose à des sanctions LCD (pénal) et à des contentieux client. C'est aussi un signal de pro pour les encaveurs sérieux.

## Acteurs

- **CLIENT / WINEMAKER / VISITEUR** : consultent la page, doivent y trouver toute l'info.
- **ADMIN / Sam** : valide le contenu juridique (idéalement avec relecture avocat externe — cf. Questions).
- **Système** : footer présent sur 100% des pages, ESEC linkant `/legal`, `/legal/privacy`, `/legal/terms`.

## Préconditions & déclencheurs

- Audit ponctuel : on relit la page existante, on identifie les manques, on les comble.
- Pas de trigger utilisateur. Livrable = checklist + page complète + commit.

## User stories

- En tant que **client** qui veut savoir qui édite EnCave, je trouve la raison sociale, l'adresse et l'IDE en 1 clic depuis n'importe quelle page.
- En tant que **encaveur** qui veut comprendre ses obligations contractuelles, je trouve les CGV claires (commission 12%, modalités de paiement, refund, juridiction).
- En tant que **PO**, je peux cocher chaque item de la checklist LCD/nLPD/alcool avant l'ouverture publique.

## Critères d'acceptation (Gherkin)

```gherkin
Fonctionnalité: Mentions légales exhaustives

Scénario: Identification éditeur (LCD art. 3 al. 1 let. s)
  Étant donné un visiteur sur /legal
  Quand il consulte la section "Éditeur du site"
  Alors il trouve la raison sociale exacte
  Et l'adresse postale complète (rue, NPA, ville, canton, pays)
  Et le numéro IDE (CHE-xxx.xxx.xxx)
  Et l'email de contact
  Et le téléphone (si applicable)
  Et le nom du responsable de publication

Scénario: Hébergeur
  Quand le visiteur consulte "Hébergement"
  Alors il trouve "Vercel Inc., 340 S Lemon Ave #4133, Walnut, CA 91789, USA"
  Et "Base de données : Neon (Amsterdam, NL)"

Scénario: Politique de confidentialité nLPD
  Quand le visiteur consulte /legal/privacy
  Alors il trouve : finalités du traitement, base légale, durées de conservation, droits (accès/rectification/effacement/portabilité), responsable du traitement, sous-traitants listés (Stripe, Resend, PostHog, Sentry, Vercel, Neon), procédure de réclamation auprès du PFPDT, transferts hors CH/UE (Stripe US, Vercel US, Sentry US, PostHog EU)

Scénario: CGV
  Quand le visiteur consulte /legal/terms
  Alors il trouve : objet, commission plateforme 12%, modalités de paiement (Stripe), politique de refund (>24h full, <24h aucun), no-show, annulation par encaveur, force majeure, responsabilité, propriété intellectuelle, juridiction (canton du Valais), droit applicable (suisse)

Scénario: Politique alcool
  Quand le visiteur consulte /legal/terms ou /legal
  Alors il trouve la mention "Expériences réservées aux 18+, contrôle ID possible"

Scénario: Cookies & consentement
  Quand le visiteur consulte /legal/privacy
  Alors il trouve la liste exhaustive des cookies par catégorie, leur durée et leur finalité
  Et un lien "Modifier mes préférences" qui rouvre la modale de consentement

Scénario: Footer global
  Étant donné n'importe quelle page publique
  Quand le visiteur regarde le footer
  Alors il voit les liens "Mentions légales", "Politique de confidentialité", "CGV", "Contact"
```

## Règles métier — Checklist d'audit (référence livrable)

### Bloc 1 — Identification éditeur (obligation LCD)

- [ ] Raison sociale exacte (forme juridique incluse : SA, Sàrl, raison individuelle…)
- [ ] Adresse postale complète CH
- [ ] Numéro IDE (CHE-xxx.xxx.xxx) — vérifier sur `https://www.uid.admin.ch`
- [ ] Numéro RC (Registre du commerce) si applicable
- [ ] N° TVA si assujetti (format CHE-xxx.xxx.xxx TVA)
- [ ] Email de contact (de préférence pas une boîte personnelle)
- [ ] Téléphone (recommandé, pas obligatoire)
- [ ] Nom du responsable de publication

### Bloc 2 — Hébergement & infrastructure

- [ ] Nom + adresse de l'hébergeur (Vercel)
- [ ] Localisation des données (Neon Amsterdam, Vercel Edge global)
- [ ] Mention des transferts internationaux

### Bloc 3 — Politique de confidentialité (nLPD)

- [ ] Identité du responsable du traitement
- [ ] Finalités du traitement (création de compte, gestion bookings, paiement, communication, mesure d'audience)
- [ ] Base légale de chaque finalité (contrat, consentement, intérêt légitime, obligation légale)
- [ ] Catégories de données traitées (identité, contact, paiement, comportement)
- [ ] Sous-traitants nommés : Stripe (US), Resend (US), PostHog (EU), Sentry (US), Vercel (US), Neon (NL), OSM Nominatim (DE)
- [ ] Transferts hors CH/UE : Stripe (US, clauses contractuelles types), Vercel (US, idem), Sentry (US, idem)
- [ ] Durées de conservation : compte actif → tant qu'actif ; après suppression → 10 ans pour les bookings (CO art. 958f), 30j logs, 30j Resend, perpétuel events PostHog si analytics opt-in
- [ ] Droits de la personne concernée : accès, rectification, effacement, opposition, portabilité
- [ ] Procédure pour exercer ces droits (lien `/settings/privacy` ou email `privacy@encave.ch`)
- [ ] Droit de réclamation auprès du PFPDT (Préposé fédéral à la protection des données)
- [ ] Date de dernière mise à jour

### Bloc 4 — CGU (Conditions générales d'utilisation)

- [ ] Objet : plateforme de mise en relation
- [ ] Acceptation des CGU au signup
- [ ] Comportements interdits (fraude, multi-comptes, contenu illégal)
- [ ] Suspension / clôture de compte
- [ ] Liens vers sites tiers
- [ ] Propriété intellectuelle (logo, contenu plateforme vs contenu utilisateurs)

### Bloc 5 — CGV (Conditions générales de vente)

- [ ] Statut EnCave : **intermédiaire / mandataire**, contrat de vente conclu directement entre client et encaveur (statut juridique à confirmer avec un avocat)
- [ ] Commission plateforme : 12%
- [ ] Modalités de paiement : Stripe, CHF, paiement comptant à la réservation
- [ ] Confirmation : email + référence ENC-XXXXXX
- [ ] Refund : >24h avant l'événement → remboursement intégral ; <24h → aucun remboursement
- [ ] Annulation par l'encaveur → refund automatique
- [ ] No-show → aucun remboursement
- [ ] Force majeure (météo extrême, fermeture sanitaire, etc.)
- [ ] Responsabilité limitée d'EnCave en tant qu'intermédiaire
- [ ] Mentions alcool 18+ et contrôle ID
- [ ] Réclamations : procédure, délai de réponse
- [ ] Droit applicable : suisse
- [ ] For : canton du Valais (à confirmer avec Sam)

### Bloc 6 — Cookies

- [ ] Lien depuis la bannière de consentement
- [ ] Liste cookies par catégorie : nom, fournisseur, finalité, durée
- [ ] Bouton "Modifier mes préférences"

### Bloc 7 — Vente d'alcool

- [ ] Mention 18+ explicite
- [ ] Contrôle ID possible à l'arrivée
- [ ] Refus de service en cas de doute (responsabilité encaveur)
- [ ] Lien vers la prévention (`stopalcool.ch` ou `addictionsuisse.ch`)

### Bloc 8 — Médiation & litige

- [ ] Procédure réclamation interne (email, délai)
- [ ] Médiation (ombudsman e-commerce CH si applicable)
- [ ] For en cas d'échec de médiation

## Copy FR définitive

Compte tenu du volume (3-4 pages), la copy détaillée ne tient pas dans ce tableau. Livrable Théo : **un draft markdown de chaque section** dans `docs/legal/` (`legal-edition.md`, `legal-privacy.md`, `legal-terms.md`, `legal-cookies.md`). Léa s'occupe de la mise en page, Nora intègre dans le routing `/legal/*`.

| Élément                 | Clé i18n suggérée           | Texte FR (extrait représentatif)                                                                                                                                                           |
| ----------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Page racine titre       | `Legal.index.title`         | Mentions légales                                                                                                                                                                           |
| Page racine intro       | `Legal.index.intro`         | Vous trouverez ici toutes les informations légales relatives à EnCave : éditeur, hébergement, conditions d'utilisation et de vente, politique de confidentialité et politique des cookies. |
| Lien CGV                | `Legal.index.linkTerms`     | Conditions générales de vente                                                                                                                                                              |
| Lien CGU                | `Legal.index.linkTos`       | Conditions générales d'utilisation                                                                                                                                                         |
| Lien privacy            | `Legal.index.linkPrivacy`   | Politique de confidentialité                                                                                                                                                               |
| Lien cookies            | `Legal.index.linkCookies`   | Politique des cookies                                                                                                                                                                      |
| Dernière maj            | `Legal.common.lastUpdated`  | Dernière mise à jour : {date}                                                                                                                                                              |
| Section éditeur titre   | `Legal.edition.title`       | Éditeur du site                                                                                                                                                                            |
| Section hébergeur titre | `Legal.edition.host.title`  | Hébergement                                                                                                                                                                                |
| Footer lien             | `Footer.legalLinks.notice`  | Mentions légales                                                                                                                                                                           |
| Footer lien privacy     | `Footer.legalLinks.privacy` | Confidentialité                                                                                                                                                                            |
| Footer lien CGV         | `Footer.legalLinks.terms`   | CGV                                                                                                                                                                                        |
| Footer lien CGU         | `Footer.legalLinks.tos`     | CGU                                                                                                                                                                                        |

Ton : neutre-juridique, vouvoiement, phrases courtes. Pas de jargon impénétrable — l'objectif est que le client moyen comprenne.

## États UI

- **Loading** : pages statiques server-rendered, pas de loader.
- **Empty** : N/A.
- **Error** : N/A (contenu statique).
- **Populated** : 4 sous-pages : `/legal`, `/legal/privacy`, `/legal/terms`, `/legal/cookies`. Sommaire / table des matières en haut de chaque sous-page longue.

## Cas limites

- **Mise à jour du contenu** : on bump la `lastUpdated` ; si modification significative de la politique de confidentialité ou des CGV, on notifie les utilisateurs actifs par email (obligation morale + transparence). Pas dans cette US, à prévoir en process ops.
- **Multi-langue** : version FR doit faire foi (à mentionner dans une clause). DE et EN peuvent être ajoutées en P1.
- **Lien depuis le checkout** : déjà obligatoire d'avoir un lien "J'accepte les CGV" avec checkbox. Vérifier qu'il pointe vers `/legal/terms` et pas vers un placeholder.

## Dépendances

- ENC-133 (cookies) : politique cookies en cohérence avec la bannière.
- ENC-134 (18+) : politique alcool en cohérence.
- ENC-135 (droit à l'oubli) : procédure décrite dans la privacy.
- ENC-136 (export données) : procédure décrite dans la privacy.
- **Relecture avocat externe** (cf. Questions ouvertes) — fortement recommandée avant ouverture publique.

## Hors-périmètre explicite

- **Traduction DE/EN** — à faire en P1 une fois la version FR validée juridiquement.
- **CGV pour les encaveurs** (contrat de mandat plateforme ↔ encaveur) : actuellement intégré dans les CGV unifiées. Une convention séparée encaveur pourra être ajoutée post-MVP.
- **DPA (Data Processing Agreement)** signé avec chaque sous-traitant : tâche ops Sam, hors code.
- **Refonte design** de la page : Léa.

## Métriques de succès

- 100% des items de la checklist sont cochés et présents en prod.
- Validation juridique externe obtenue (oui/non) — cf. Questions.
- 0 lien mort dans le footer et entre les pages légales.

## ❓ Questions ouvertes pour Sam

1. **Forme juridique EnCave** : Sàrl ? SA ? Raison individuelle ? J'ai besoin du nom exact + IDE + adresse RC pour rédiger le bloc éditeur. Tu peux me transmettre ?
2. **For juridique** : canton du Valais (Sion ?) cohérent avec le siège, ou tu préfères un autre canton ? Ma reco : Valais, simple et aligné branding.
3. **Statut juridique EnCave plateforme** : intermédiaire / mandataire / commissionnaire ? Ça change beaucoup la rédaction des CGV (responsabilité, fiscalité). **Relecture avocat fortement recommandée ici.** As-tu un avocat suisse e-commerce / startup à mobiliser ?
4. **Email contact légal** : `legal@encave.ch` ? `privacy@encave.ch` ? Tu valides la création des aliases ?
5. **Traduction** : on fait FR pour le MVP et on traduit DE/EN après ouverture, ou tu veux les 3 dès le launch ? Reco : FR au launch, DE/EN dans les 30 jours suivants.
6. **Médiation e-commerce CH** : tu veux qu'on s'inscrive à un dispositif type "Online Ombudsman" suisse ? Pas obligatoire mais signal de pro.
