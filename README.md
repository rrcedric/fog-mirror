# Fog Mirror

Un miroir embué dans le navigateur : la webcam affiche votre reflet, votre souffle crée de la buée, et vous écrivez dedans avec le doigt.

Tout tourne en local, aucune image ni aucun son ne quitte l'appareil. Le plan de conception est dans [docs/PLAN.md](docs/PLAN.md).

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

Dans l'app :

| Contrôle                                                          | Effet                                                                                |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Ouvrir la bouche face à la caméra (« o », moue ou bouche ouverte) | Souffler : la buée naît sur la bouche et suit la tête                                |
| Tendre l'index (autres doigts repliés) face à la caméra           | Écrire dans la buée ; un cercle suit le bout de l'index et se remplit quand on écrit |
| Maintenir le clic gauche                                          | Souffler à la position du pointeur                                                   |
| Clic droit glissé, ou Maj + clic gauche glissé                    | Écrire dans la buée                                                                  |
| `E` / `C`                                                         | Tout embuer / tout effacer                                                           |
| `D`                                                               | Afficher ou masquer l'overlay de debug et le panneau de réglages                     |

Ajouter `?r8` à l'URL force le champ de buée en 8 bits, pour tester le repli utilisé quand les textures flottantes ne sont pas disponibles.

## Détection du visage

La bouche est détectée par [MediaPipe Face Landmarker](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker/web_js), entièrement dans le navigateur. Tout est servi depuis le site lui-même :

- le modèle `public/models/face_landmarker.task` (float16, version 1) est versionné dans le dépôt ;
- les fichiers WASM sont copiés depuis `node_modules` vers `public/mediapipe/wasm` par `scripts/copy-mediapipe-wasm.mjs`, lancé automatiquement après `npm install`.

Le panneau de réglages (`D`) affiche le contour des lèvres, le score de « forme de souffle » et ses seuils, et permet de les ajuster dans le dossier « Visage ».

## Suivi de la main

L'index est suivi par [MediaPipe Hand Landmarker](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/web_js) (modèle `public/models/hand_landmarker.task`, float16, version 1). On écrit quand l'index est tendu et les autres doigts repliés : pour chaque doigt, on compare la distance poignet → bout à la distance poignet → articulation du milieu, en coordonnées 3D, ce qui ne dépend ni de la taille ni de l'inclinaison de la main. La position du bout de l'index est lissée par un filtre One Euro.

Les deux modèles tournent sur le thread principal. Un ordonnanceur répartit un budget de temps par image de la caméra : si visage et main tiennent dans le budget, les deux tournent à chaque image ; sinon ils alternent, la main passant en priorité pendant qu'on écrit. Les réglages sont dans les dossiers « Main » et « Performances » du panneau (`D`).

## Déploiement

Le workflow `.github/workflows/deploy.yml` publie sur GitHub Pages à chaque push sur `main` (activer Pages avec la source « GitHub Actions » dans les réglages du dépôt).
