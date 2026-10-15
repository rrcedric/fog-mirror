# Fog Mirror

Un miroir embué dans le navigateur : la webcam affiche votre reflet, votre souffle dépose de la buée sur le miroir, et vous écrivez dedans du bout du doigt, en l'air.

**Essayer : https://rrcedric.github.io/fog-mirror/** (ordinateur avec webcam, navigateur récent).

Tout tourne dans le navigateur : aucune image ne quitte l'appareil (voir [Confidentialité](public/confidentialite.html)).

## Fonctionnalités

- **Souffle** : ouvrez la bouche face à la caméra, la buée naît sur votre bouche, suit la tête et prend une forme organique.
- **Écriture au doigt** : index tendu, autres doigts repliés ; un cercle suit le bout de l'index et se remplit quand vous écrivez. Le trait s'affine quand le doigt va vite.
- **Buée réaliste** : flou et voile, grain fin, bords humides qui accrochent la lumière, rares gouttes posées, gouttes qui coulent sous les tracés en laissant une traînée, tracés qui se ré-embuent peu à peu.
- **Tout effacer** : main ouverte pendant une seconde, bouton ou touche `C`.
- **Enregistrer une image** du miroir en PNG, telle qu'à l'écran.
- **Guide d'accueil** en trois étapes, aide, plein écran, réglages simplifiés mémorisés.
- **Qualité adaptative** : la résolution baisse si l'affichage n'est plus fluide.
- **Repli à la souris** : si le suivi du visage ou de la main est indisponible, tout reste utilisable à la souris.

## Utilisation

| Contrôle                                       | Effet                                                                                |
| ---------------------------------------------- | ------------------------------------------------------------------------------------ |
| Ouvrir la bouche face à la caméra              | Souffler : la buée naît sur la bouche et suit la tête                                |
| Tendre l'index (autres doigts repliés)         | Écrire dans la buée ; un cercle suit le bout de l'index et se remplit quand on écrit |
| Main ouverte pendant une seconde               | Tout effacer                                                                         |
| Maintenir le clic gauche                       | Souffler à la position du pointeur                                                   |
| Clic droit glissé, ou Maj + clic gauche glissé | Écrire dans la buée                                                                  |
| `C` / `E`                                      | Tout effacer / tout embuer                                                           |
| `S`                                            | Enregistrer l'image du miroir en PNG                                                 |
| `F`                                            | Plein écran                                                                          |
| `H` ou `?`                                     | Aide                                                                                 |
| `D`                                            | Overlay de debug et réglages complets (aussi avec `?debug` dans l'URL)               |

Ajouter `?r8` à l'URL force le champ de buée en 8 bits, pour tester le repli utilisé quand les textures flottantes ne sont pas disponibles.

## Comment ça marche

Le plan de conception détaillé est dans [docs/PLAN.md](docs/PLAN.md).

- **Rendu** (`src/lib/fog/`) : WebGL2. Un champ à deux canaux (buée visible, humidité) évolue à chaque frame : dépôt du souffle, effacement le long des tracés, évaporation, diffusion, ré-embuage. L'image finale floute la vidéo (pyramide « dual Kawase ») selon l'épaisseur de buée, y ajoute un voile, du grain, des gouttes et des reflets.
- **Visage** (`src/lib/tracking/face.ts`) : [MediaPipe Face Landmarker](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker/web_js). La position de la bouche et trois scores d'expression (mâchoire ouverte, bouche en « o », moue) donnent un score de souffle, lissé et avec hystérésis.
- **Main** (`src/lib/tracking/hand.ts`, `gesture.ts`) : [MediaPipe Hand Landmarker](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/web_js). Les gestes comparent, pour chaque doigt, les distances poignet → bout et poignet → articulation en 3D, ce qui ne dépend ni de la taille ni de l'inclinaison de la main. Le tracé est lissé (filtre One Euro) puis arrondi en courbes.
- **Ordonnanceur** (`src/lib/tracking/scheduler.ts`) : les deux modèles se partagent un budget de temps par image de la caméra ; la main passe en priorité pendant qu'on écrit.
- **Entrées** (`src/lib/input/`) : souris, visage, main et gouttes qui coulent envoient les mêmes événements (souffle, trait) au moteur, qui ne sait pas d'où ils viennent.

Les modèles (`public/models/*.task`, float16, version 1) sont versionnés dans le dépôt ; les fichiers WASM de MediaPipe sont copiés depuis `node_modules` vers `public/mediapipe/wasm` par `scripts/copy-mediapipe-wasm.mjs`, lancé après `npm install`. Le site ne contacte aucun autre service.

## Compatibilité

Testé sur Chrome et Safari (macOS). Firefox et Edge ne sont pas encore testés ; le code prévoit leurs différences :

- WebGL2 obligatoire ; champ de buée en flottant 16 bits, ou en 8 bits avec tramage si le navigateur ne peut pas dessiner en flottant ;
- `requestVideoFrameCallback` utilisé s'il existe, sinon détection des nouvelles images à chaque frame ;
- MediaPipe sur GPU, sinon sur CPU ; sans suivi, les contrôles souris restent disponibles ;
- plein écran et flou d'arrière-plan avec les variantes préfixées de Safari.

## Développement

```bash
npm install
npm run dev
```

| Commande         | Rôle                                             |
| ---------------- | ------------------------------------------------ |
| `npm run dev`    | Serveur de développement (http://localhost:5173) |
| `npm run build`  | Build de production dans `dist/`                 |
| `npm run check`  | Vérification des types (Svelte + TypeScript)     |
| `npm run lint`   | ESLint                                           |
| `npm run format` | Prettier                                         |
| `npm test`       | Tests unitaires (Vitest)                         |

En développement, le moteur est accessible depuis la console (`window.__engine`) et la touche `D` affiche l'overlay de debug et le panneau de réglages complet (Tweakpane), avec « Copier les réglages (JSON) » pour fixer de nouvelles valeurs par défaut.

## Déploiement

Le workflow `.github/workflows/deploy.yml` vérifie les types, le lint et les tests, puis publie sur GitHub Pages à chaque push sur `main` (Pages configuré avec la source « GitHub Actions »).

## Crédits

- [MediaPipe Tasks Vision](https://github.com/google-ai-edge/mediapipe) et ses modèles Face Landmarker et Hand Landmarker (Google, Apache 2.0).
- [Svelte](https://svelte.dev), [Vite](https://vite.dev), [Tweakpane](https://tweakpane.github.io/docs/) (MIT).
- Filtre One Euro : Casiez, Roussel et Vogel, CHI 2012. Flou dual Kawase : Marius Bjørge, SIGGRAPH 2015.
