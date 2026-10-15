# Fog Mirror — Plan de conception

Application web qui transforme l'écran en miroir embué : la webcam affiche le reflet de l'utilisateur, son souffle crée de la buée là où se trouve sa bouche, et il peut dessiner dans la buée avec le doigt (en l'air, suivi par la caméra) ou à la souris.

## État

**v1 publiée le 15 octobre 2026** : https://rrcedric.github.io/fog-mirror/

| Jalon                       | État                                                                          |
| --------------------------- | ----------------------------------------------------------------------------- |
| J0 — Mise en place          | Fait                                                                          |
| J1 — Le miroir              | Fait                                                                          |
| J2 — Moteur de buée v1      | Fait                                                                          |
| J3 — Détection de la bouche | Fait                                                                          |
| J4 — Souffle au micro       | Abandonné (le souffle repose sur la forme de la bouche)                       |
| J5 — Doigt en l'air         | Fait, avec tracé organique                                                    |
| J6 — Réalisme               | Fait : ré-embuage des tracés, gouttes qui coulent, forme organique du souffle |
| J7 — Expérience et finition | Fait (testé sur Chrome et Safari)                                             |
| J8 — Publication            | Fait                                                                          |

Le reste de ce document est le plan initial, mis à jour au fil des décisions.

## Choix retenus

| Sujet                  | Décision                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------- |
| Niveau                 | Solution 2 : miroir réaliste                                                                      |
| Cible                  | Ordinateur + webcam (écran non tactile)                                                           |
| Interaction principale | Doigt en l'air (MediaPipe Hand Landmarker), souris en secours et pour le développement            |
| Déclencheur du souffle | Forme de la bouche seule (blendshapes) ; pas de micro (abandonné après essai, voir J4)            |
| Rendu                  | Shader WebGL2 avec un champ de densité de buée (textures ping-pong)                               |
| Stack                  | Vite + Svelte 5 + TypeScript, WebGL2 brut avec quelques helpers maison, `@mediapipe/tasks-vision` |
| Hébergement            | Statique (GitHub Pages / Netlify / Vercel), HTTPS obligatoire pour la caméra                      |
| Vie privée             | 100 % local : aucune image ne quitte l'appareil                                                   |

## Architecture

```
src/
  app/                 Composants Svelte : écrans (accueil, permissions, miroir), panneau de réglages, overlay debug
  lib/
    camera/            getUserMedia, élément <video>, gestion des erreurs et permissions
    tracking/
      face.ts          Face Landmarker → { mouthPos, breathShapeScore }
      hand.ts          Hand Landmarker → { indexTip, isDrawing }
      scheduler.ts     Ordonnance les inférences (budget par frame, alternance face/main)
      filters.ts       Filtre One-Euro, hystérésis
    input/
      events.ts        Bus d'événements unifié : BreathEvent{x,y,intensity}, StrokeEvent{x,y,radius}
      pointer.ts       Souris → StrokeEvent / BreathEvent (debug)
    coords.ts          Conversion vidéo normalisée → écran (miroir, object-fit: cover)
    fog/
      engine.ts        Contexte WebGL2, boucle de rendu, redimensionnement
      field.ts         Champ de densité (2 textures ping-pong, demi-résolution)
      passes/          splat.frag, update.frag (évaporation, diffusion), composite.frag, blur.frag
      params.ts        Paramètres physiques et visuels (réglables)
  stores/              État Svelte : réglages, statut des permissions, métriques de performance
```

Principes :

- **Le moteur graphique et le tracking sont du TypeScript pur**, sans dépendance à Svelte. Svelte ne gère que l'interface et l'état. Les deux parties sont ainsi testables et remplaçables séparément.
- **Toutes les sources d'interaction produisent les mêmes événements** (`BreathEvent`, `StrokeEvent`). Le moteur de buée ne sait pas si un trait vient de la souris ou de la main.
- **Les coordonnées circulent sous forme normalisée (0..1)**, dans l'espace « miroir ». Une seule fonction (`coords.ts`) gère l'inversion et le recadrage.

### Le champ de buée

Une texture `R16F` (ou `RGBA8` en repli) stocke la densité de buée de chaque pixel, à demi-résolution. À chaque frame :

1. **Splat souffle** : on ajoute une gaussienne à la position de la bouche, dont l'intensité dépend du souffle détecté. Si la tête bouge pendant qu'on souffle, on obtient une traînée.
2. **Splat doigt** : on retire de la densité le long du segment entre la position précédente et la position actuelle du doigt (sans trous quand le geste est rapide).
3. **Mise à jour** : la buée s'évapore lentement (décroissance exponentielle), se diffuse légèrement (flou 3×3) et un bruit module l'évaporation pour éviter un fondu trop uniforme.
4. **Composite** : on mélange l'image webcam nette et une version floutée selon la densité, on ajoute un voile blanc et un bruit de micro-gouttelettes, et on dévie légèrement les UV (réfraction) là où la densité varie.

## Jalons

Les durées sont des ordres de grandeur en jours de développement à temps partiel.

### J0 — Mise en place (½ j)

- Projet Vite + Svelte 5 + TypeScript, ESLint/Prettier, Vitest.
- Déploiement continu sur un hébergement statique.
- **Terminé quand** une page « Hello » est en ligne en HTTPS.

### J1 — Le miroir (1 j)

- Écran d'accueil qui explique ce qui va être demandé, puis demande d'accès à la caméra.
- Gestion des erreurs : pas de caméra, accès refusé, caméra déjà utilisée.
- Flux vidéo affiché en texture WebGL2, inversé gauche-droite, plein écran (`cover`).
- Compteur de FPS dans un overlay de debug.
- **Terminé quand** on se voit en miroir plein écran à 60 fps.

### J2 — Moteur de buée v1, piloté à la souris (2–3 j)

- Champ de densité ping-pong, passes splat, mise à jour et composite (version simple : flou + voile).
- Contrôles provisoires : clic maintenu = souffle, clic droit glissé = trace de doigt.
- Panneau de réglages en mode dev (Tweakpane) : taux d'évaporation, rayon et intensité du souffle, épaisseur du trait, flou.
- Repli `RGBA8` si les textures flottantes ne sont pas disponibles (Safari).
- **Terminé quand** on peut embuer le miroir et écrire dedans à la souris, et que la buée disparaît progressivement.

### J3 — Détection de la bouche (2 j)

- Face Landmarker en mode VIDEO avec les blendshapes activés.
- Position de la bouche : centre des lèvres intérieures, converti en coordonnées écran.
- Score de « forme de souffle » : combinaison pondérée de `jawOpen`, `mouthFunnel` et `mouthPucker`, lissée, avec hystérésis (seuil d'activation plus haut que le seuil de désactivation).
- Overlay de debug : points des lèvres, jauge du score.
- La buée suit la bouche, ce qui crée la traînée quand on bouge la tête.
- **Terminé quand** souffler devant la caméra embue le miroir au bon endroit, sans micro.

### J4 — Souffle au micro et fusion (abandonné)

- Essayé puis retiré à la demande : le souffle est déclenché par la seule ouverture de la bouche (J3).
- Le code (détection audio par niveau et platitude spectrale locale, fusion avec la forme de la bouche) est conservé dans un stash git, « J4 micro », si on veut y revenir.

### J5 — Doigt en l'air (3 j)

- Hand Landmarker : bout de l'index (point 8).
- Geste « dessiner » : index tendu et autres doigts repliés, calculé avec les distances au poignet. Hystérésis pour éviter que le trait se coupe.
- Lissage avec un filtre One-Euro, et interpolation des positions entre deux détections.
- **Retour visuel indispensable** (l'écran n'est pas touché) : un curseur discret suit l'index, et devient « actif » en mode dessin.
- Ordonnanceur : alternance ou budget de temps entre visage et main, inférence sur une vidéo réduite, et passage dans un Web Worker si le thread principal sature.
- **Terminé quand** on écrit lisiblement un mot en l'air, à 30 fps minimum en faisant tourner les deux modèles sur un portable courant.

### J6 — Réalisme (3–4 j)

- Flou de qualité (dual Kawase ou mipmaps) au lieu du flou simple.
- Texture de micro-gouttelettes (bruit de Worley) qui grossit avec la densité.
- Bords humides : un léger halo plus dense autour des traces de doigt.
- Réfraction légère et reflet spéculaire discret.
- Ré-embuage réaliste d'une trace quand on souffle dessus.
- Réglage fin des paramètres par défaut, sous différentes lumières.
- **Terminé quand** le rendu « fait vrai » sur une capture d'écran.

### J7 — Expérience et finition (2–3 j)

- Parcours d'accueil : permission de la caméra, consigne « Soufflez sur le miroir ».
- Effacer tout (bouton, ou geste main ouverte maintenue).
- Capture du miroir en PNG.
- Plein écran, raccourcis clavier, panneau de réglages simplifié pour l'utilisateur.
- Qualité adaptative : on baisse la résolution du champ ou la fréquence d'inférence si les FPS chutent.
- Compatibilité : Chrome, Edge, Firefox, Safari (macOS).
- **Terminé quand** un utilisateur qui découvre l'app y arrive sans aide.

### J8 — Publication (1 j)

- Tests unitaires sur la logique pure (`coords`, filtres, détecteur de forme de souffle).
- README, page « vie privée » (tout est local), mise en ligne de la v1.

**Total estimé : environ 15 à 19 jours de développement** (sans J4).

## Risques et parades

| Risque                                                                  | Parade                                                                                  |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Faire tourner visage et main en même temps est trop lent                | Alternance des modèles, vidéo d'entrée réduite, Web Worker, qualité adaptative (J5, J7) |
| Buée déclenchée en parlant bouche ouverte (pas de micro pour confirmer) | Seuils de la forme de la bouche réglables (J3) ; accepté                                |
| Scores des blendshapes variables selon la personne et l'éclairage       | Seuils réglables, calibration rapide au démarrage si nécessaire                         |
| Tracé du doigt qui tremble                                              | Filtre One-Euro, hystérésis, curseur de retour visuel (J5)                              |
| Textures flottantes absentes sur certains navigateurs                   | Repli `RGBA8` (J2)                                                                      |
| Décalage entre image et coordonnées (miroir, recadrage)                 | Une seule fonction `coords.ts`, testée unitairement                                     |

## Pistes après la v1

- Gouttes qui se forment au bord des traces et qui coulent.
- Plusieurs personnes devant le miroir.
- Mode « borne » pour un écran tactile.
- Enregistrement d'une courte vidéo ou d'un GIF.
