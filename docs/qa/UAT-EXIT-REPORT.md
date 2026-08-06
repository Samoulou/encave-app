# UAT-EXIT-REPORT — Rapport de sortie de campagne (gabarit)

> À remplir en clôture de campagne. C'est **le** document qui autorise (ou
> non) la bascule `dev` → `main` du launch. Signature GO/NO-GO en fin de
> document. Les critères viennent de UAT-CAMPAIGN §9.2 et du plan approuvé.
> Les blancs `` `____` `` sont à remplir.

## 1. Identité de la campagne

```
SHA gelé (dev/staging) : ______________________
Période d'exécution    : du __________ au __________
Exécutant              : Sam
Re-seeds effectués     : J0 __________ (+ re-seeds inter-blocs : ____________)
```

## 2. Critères GO (tous cochés = condition nécessaire)

### 2.1 Sessions UAT

- [ ] S1–S15 exécutées à 100 % (15/15 fiches à verdict PASS)
- [ ] **0 Blocker** ouvert
- [ ] Tous les P1 : corrigés + retestés, **ou** acceptés explicitement (§4)
- [ ] Re-smokes effectués après chaque fix mergé (gel de version respecté)

| Session | Verdict | Date | Défauts ouverts restants |
| ------- | ------- | ---- | ------------------------ |
| S1      |         |      |                          |
| S2      |         |      |                          |
| S3      |         |      |                          |
| S4      |         |      |                          |
| S5      |         |      |                          |
| S6      |         |      |                          |
| S7      |         |      |                          |
| S8      |         |      |                          |
| S9      |         |      |                          |
| S10     |         |      |                          |
| S11     |         |      |                          |
| S12     |         |      |                          |
| S13     |         |      |                          |
| S14     |         |      |                          |
| S15     |         |      |                          |

### 2.2 Money-routing (Volet D — gate bloquant)

- [ ] Bloc A (a)→(f) : 100 % PASS, **captures Stripe archivées**
      (lien/dossier : `____`)
- [ ] Bloc B : 12/12 · [ ] Bloc C : 6/6 · [ ] Bloc D : 3/3 (+ D4)
- [ ] Q3 (invariant bons) vide et Q4 (StripeEvent) vide en fin de campagne
- [ ] Parcours 20 (payouts + relevé PDF) validé via Bloc A.e

### 2.3 Gates ops (chronos consignés)

- [ ] Kill-switch flag : `____` s (**< 60 s**)
- [ ] Incident simulé (E.2) : `____` min (**< 5 min**) — monitor externe
      `/api/health?deep=1` en place : OUI / NON
- [ ] G-1 MFA validé sur preview (E.3 / S12-F)
- [ ] Crons Vercel : 18 entrées actives, plan ≥ Pro confirmé
- [ ] LHCI staging ≥ 95 (job `lhci-staging`, médiane 3 runs) : score `____`

### 2.4 Hors UAT (rappel — à vérifier avant la bascule, autres gates P-16)

- [ ] `/security-review` : 0 blocker
- [ ] CI verte sur dev (incl. suites db Volet B + i18n:check)
- [ ] Emails : 22/22 statués dans [UAT-EMAIL-CHECKLIST.md](./UAT-EMAIL-CHECKLIST.md)

## 3. Matrice flags du launch (état arrêté — photographiée en S15)

| Flag                  | Launch                        | Constaté staging (S15) | Commentaire          |
| --------------------- | ----------------------------- | ---------------------- | -------------------- |
| `BOOKING_FEE`         | ON                            |                        |                      |
| `GIFT_CARDS`          | ON                            |                        |                      |
| `NO_SHOW_FEES`        | ON                            |                        |                      |
| `REQUESTS`            | ON                            |                        |                      |
| `TASTING_SHEET`       | ON                            |                        |                      |
| `COLLECTIVE_EVENTS`   | ON                            |                        |                      |
| `OCCURRENCE_CAPACITY` | ON (défaut)                   |                        |                      |
| `COMING_SOON` (env)   | à couper au launch (redeploy) |                        | middleware encave.ch |

Configuration monétaire launch : commission par défaut env
`PLATFORM_COMMISSION_RATE` = `____` · caves fondatrices à 0 %
(liste : `____`)

## 4. Dettes acceptées (P1/P2 assumés — décision explicite)

| ID défaut | Description courte | Sévérité | Décision (qui/quand) | Échéance de correction |
| --------- | ------------------ | -------- | -------------------- | ---------------------- |
|           |                    |          |                      |                        |

Dettes structurelles connues à trancher ici :

- [ ] Unsubscribe non tokenisé des 3 emails d'agrégat (S13-C) :
      ☐ corrigé avant launch · ☐ accepté, échéance `____`
- [ ] Email #12 « vos billets » sans template distinct (couvert par #1) :
      ☐ accepté · ☐ template à créer, échéance `____`
- [ ] Carte sauvegardée (`setup_future_usage`) non implémentée (PAGES §4) :
      ☐ accepté post-launch
- [ ] Monitor externe `/api/health?deep=1` : ☐ en place · ☐ à mettre en place
      avant launch (sans lui, l'astreinte est aveugle)
- [ ] Runbook `kill-switch-flags.md` : corriger la référence
      `/admin/compliance` → `/admin` (panneau flags)

## 5. Écarts plan-vs-code confirmés en exécution

(Repartir de UAT-CAMPAIGN §11 ; ajouter ce que la campagne a révélé.)

| #   | Écart | Impact | Suite donnée |
| --- | ----- | ------ | ------------ |
|     |       |        |              |

## 6. Chiffres de campagne

```
Sessions exécutées : ____ / 15 · Retests : ____
Défauts : Blocker ____ · P1 ____ · P2 ____ · P3 ____
Temps total Sam : ______ h (estimation plan : ~25 h)
Bookings créés : ____ · Bons créés : ____ · Requests : ____
```

## 7. Décision

> GO = bascule `dev` → `main` autorisée dans la configuration §3.
> NO-GO = fusible planning (launch glissable au 23.11), liste des conditions
> de re-présentation ci-dessous.

```
Décision : [ ] GO   ·   [ ] NO-GO

Conditions restantes si NO-GO :
1. ______________________________________________________________
2. ______________________________________________________________

Signature : Sam ______________________   Date : ______________
```
