# Docs V3 — source de vérité produit & business

Ces documents définissent la **cible V3** d'EnCave. Chaque epic (`/ultraplan`, spec ENC-XXX) les référence.

| Doc                                                      | Rôle                                         |
| -------------------------------------------------------- | -------------------------------------------- |
| [ENCAVE-V3-PRD.md](./ENCAVE-V3-PRD.md)                   | Scope, personas, user stories, MoSCoW, NFR   |
| [ENCAVE-V3-BUSINESS.md](./ENCAVE-V3-BUSINESS.md)         | Modèle économique, grille tarifaire, scaling |
| [ENCAVE-V3-PAGES-EMAILS.md](./ENCAVE-V3-PAGES-EMAILS.md) | Inventaire complet des écrans et emails      |
| [ENCAVE-V3-PLANNING.md](./ENCAVE-V3-PLANNING.md)         | Phases, gates, chemin critique, fusibles     |

État actuel vs cible : [../ENCAVE-V3-GAP-ANALYSIS.md](../ENCAVE-V3-GAP-ANALYSIS.md).

## Décisions d'adaptation (09.07.2026)

La V3 se construit **par convergence incrémentale depuis la base V2 existante**, pas par réécriture. Décisions actées avec Sam :

1. **On garde tout ce qui existe et fonctionne** ; on l'étend vers la cible V3. Aucune réécriture cosmétique.
2. **Stack** : les références techniques des docs V3 (Supabase, Drizzle, Trigger.dev, RLS Postgres, magic link, Axiom, monorepo, k6 « stack ») sont **remplacées par la stack du repo** : Next.js 14 + Prisma 5 + Neon + better-auth + Vercel Cron + Upstash + Sentry/PostHog. Le `CLAUDE.md` racine fait foi pour la technique ; ces docs font foi pour le produit, l'UX et le business.
   - « RLS 100% » se traduit par : isolation applicative systématique (filtres Prisma par tenant) + invariants DB (contraintes/CHECK) + tests rôle×ressource.
   - « holds Redis » se traduit par : mécanisme de hold sur la base existante (`Booking.expiresAt` + transaction Serializable), durcissement selon US-201.
   - Les jobs différés (relances Request, envoi programmé des bons cadeaux, email J+2) passent par **Vercel Cron + tables de scheduling**, pas Trigger.dev.
3. **Routes** : les routes existantes gardent leur chemin actuel (anglais). Les **nouvelles** surfaces suivent le sitemap français de l'inventaire (`/cadeaux`, `/sur-mesure`, `/compte`…). Tout renommage d'existant = epic dédié avec redirects.
4. **Toute feature financière** (bons cadeaux, no-show fees, fee client, commissions par palier) est **feature-flaggée** et désactivable sans deploy.
5. `ENCAVE-V3-ARCHITECTURE.md` et `ENCAVE-V3-DESIGN.md` (v2, « Cuir & Taupe ») ne sont pas encore versionnés ici — à ajouter quand disponibles. Le socle design (Fraunces + palette premium) est déjà implémenté dans l'app.
