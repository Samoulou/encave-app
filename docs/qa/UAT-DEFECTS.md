# UAT-DEFECTS — Registre des anomalies de la campagne

> Une ligne par anomalie, ouverte **pendant** la session concernée.
> Rien ne se corrige sans ligne ici ; rien ne se ferme sans retest consigné.

## Format d'identifiant

`UAT-Sxx-yy` — `Sxx` = session d'origine (S01–S15, `VD` pour le Volet D
money-routing), `yy` = compteur à deux chiffres dans la session.
Exemples : `UAT-S01-01`, `UAT-S08-03`, `UAT-VD-02`.

## Sévérités (définitions — UAT-CAMPAIGN §9.3)

| Sévérité    | Définition                                                                                                                                           | Politique de sortie                                                           |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **Blocker** | Argent perdu/mal routé, survente, fuite de données, impossible de payer/annuler, email #1 absent ou QR non scannable, refus gift-funded contournable | **0 toléré** — corrigé + retesté avant GO                                     |
| **P1**      | Parcours dégradé avec workaround, montant affiché faux, email secondaire manquant, i18n cassée sur parcours cœur, propagation flag > 60 s            | Corrigé + retesté, **ou** accepté explicitement par Sam (consigné au rapport) |
| **P2**      | Cosmétique gênant, wording, layout                                                                                                                   | Backlog post-launch accepté                                                   |
| **P3**      | Mineur, hors parcours cœur                                                                                                                           | Backlog                                                                       |

## Cycle de vie (colonne Statut)

`OUVERT` → `EN COURS` (fix identifié) → `À RETESTER` (fix mergé sur dev,
staging redéployé) → `FERMÉ` (retest PASS, consigné) · ou `ACCEPTÉ` (P1/P2
assumé par Sam, repris dans les dettes du rapport de sortie) · ou `REJETÉ`
(pas un défaut — justifier).

> Rappel gel de version : chaque fix mergé pendant la campagne = re-smoke
> 15 min (S1 raccourcie) avant de reprendre les sessions.

## Registre

| ID  | Sév. | Session | Parcours / US | Description (observé vs attendu) | Artefacts (ENC-, pi\_, ENCV-, capture) | Statut | Commit fix | Retest (date + verdict) |
| --- | ---- | ------- | ------------- | -------------------------------- | -------------------------------------- | ------ | ---------- | ----------------------- |
|     |      |         |               |                                  |                                        |        |            |                         |
|     |      |         |               |                                  |                                        |        |            |                         |
|     |      |         |               |                                  |                                        |        |            |                         |
|     |      |         |               |                                  |                                        |        |            |                         |
|     |      |         |               |                                  |                                        |        |            |                         |
|     |      |         |               |                                  |                                        |        |            |                         |
|     |      |         |               |                                  |                                        |        |            |                         |
|     |      |         |               |                                  |                                        |        |            |                         |

## Modèle de ligne (à copier)

```
| UAT-Sxx-yy | P1 | Sxx | parcours N / US-XXX | Observé : … Attendu : … | ENC-…, pi_…, capture … | OUVERT | — | — |
```

## Compteurs (à jour en fin de campagne)

```
Blocker : ____ (ouverts ____ / fermés ____)
P1      : ____ (fermés ____ / acceptés ____)
P2      : ____   P3 : ____
```
