---
workflow: product-launch-video
flow: automation
storyboard: yes
message: "EnCave connecte les caves valaisannes à leurs clients, de la réservation à la gestion — les deux faces du marché, sans friction."
destination: youtube
aspect: 1920x1080
language: fr
audience: "Encaveurs valaisans et touristes/amateurs de vin envisageant de réserver une expérience"
length: 75-90s
angle: "Parcours en miroir — le client découvre et réserve une expérience, puis bascule côté encaveur qui gère cette réservation dans son espace"
narration: no
---

## Intent

Site tour (show-it-as-is) d'EnCave, plateforme de réservation d'expériences
oenotouristiques en Valais (dégustations, visites de caves). L'objectif est
de présenter l'application en montrant ses écrans réels — pas un argumentaire
vendeur — pour publication sur YouTube. Trois sections capturées dans l'ordre :
(1) le catalogue d'expériences, (2) le parcours de réservation client jusqu'au
checkout (sans payer), (3) l'espace encaveur (dashboard) après connexion.
Ton chaleureux, terroir, pas corporate.

## Assets

Aucun fichier fourni par l'utilisateur — logo et musique choisis librement à
partir du site capturé (wordmark EnCave visible sur le site) et de la
bibliothèque musicale HeyGen (ambiance chaleureuse/terroir, pas générique
corporate).

## Customizations

- Curseur animé qui navigue/clique à travers l'interface (pas de voix-off).
- Callouts textuels sur les moments clés de chaque section plutôt qu'une
  narration continue.
- Capture avec connexion réelle (compte de test winemaker) pour la section
  espace encaveur — les identifiants sont fournis hors-brief, jamais
  persistés dans ce projet.
- Pas de musique : pas de connexion HeyGen possible depuis ce sandbox distant
  (OAuth navigateur inaccessible) et l'utilisateur a choisi de ne pas
  installer le moteur local MusicGen. Vidéo silencieuse, callouts textuels
  uniquement. L'utilisateur pourra ajouter sa propre musique en post-prod.

## Notes

- Site source : https://encave-dev.vercel.app/fr (staging, locale FR).
- Espace encaveur : ne pas s'attarder sur des écrans affichant des données
  personnelles de clients de test (listes de réservations avec noms/emails) —
  privilégier les vues agrégées (KPIs, calendrier, revenus) plutôt que les
  listes nominatives.
- Pas de paiement réel : le parcours checkout s'arrête avant la confirmation
  Stripe.
