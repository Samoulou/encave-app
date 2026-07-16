# Runbook — Astreinte

> Canaux, fenêtres et rotation = **décision Sam** (P-16, décision restante).
> Ce document fixe le cadre ; compléter les [À DÉCIDER] avant la bascule.

## Signaux entrants

| Source | Canal | Gravité |
| --- | --- | --- |
| Better Stack / moniteur uptime sur `/api/health?deep=1` (non-200) | [À DÉCIDER : e-mail / SMS / push] | Haute — paiements potentiellement impactés |
| Alerte Sentry `area:stripe-webhook` | E-mail Sentry → [À DÉCIDER] | Haute |
| Alerte Sentry `area:gift-transfer` | idem | Haute (cave non payée) |
| Alerte Sentry `area:email` | idem | Moyenne |
| Sentry Cron Monitor « missed check-in » (cron mort) | idem | Moyenne |
| Client / cave via contact@encave.ch | Boîte mail | Variable |

## Fenêtres de réponse (proposition à valider)

- **Haute** : prise en main < 30 min en journée (08:00–20:00 Europe/Zurich),
  best-effort la nuit. Objectif diagnostic < 5 min une fois devant l'écran
  (runbook `incident-paiement.md`).
- **Moyenne** : sous 24 h.
- Personne d'astreinte : [À DÉCIDER — Sam seul au lancement].

## Réflexes

1. Accuser réception (canal interne) : qui prend, quel signal.
2. Ouvrir le runbook correspondant (`incident-paiement`, `litige-no-show`,
   `restauration-db`, `kill-switch-flags`).
3. Si l'argent est en jeu et le fix n'est pas immédiat → couper le flag
   concerné (< 1 min) plutôt que laisser saigner.
4. Consigner : horodatage, impact, action, suivi (post-mortem si > 30 min
   d'impact).

## Contacts techniques

- Vercel status : https://www.vercel-status.com
- Neon status : https://neonstatus.com
- Stripe status : https://status.stripe.com
- Resend status : https://resend-status.com
