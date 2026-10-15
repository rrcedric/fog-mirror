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

| Contrôle                                       | Effet                                                            |
| ---------------------------------------------- | ---------------------------------------------------------------- |
| Maintenir le clic gauche                       | Souffler à la position du pointeur                               |
| Clic droit glissé, ou Maj + clic gauche glissé | Écrire dans la buée                                              |
| `E` / `C`                                      | Tout embuer / tout effacer                                       |
| `D`                                            | Afficher ou masquer l'overlay de debug et le panneau de réglages |

Ajouter `?r8` à l'URL force le champ de buée en 8 bits, pour tester le repli utilisé quand les textures flottantes ne sont pas disponibles.

## Déploiement

Le workflow `.github/workflows/deploy.yml` publie sur GitHub Pages à chaque push sur `main` (activer Pages avec la source « GitHub Actions » dans les réglages du dépôt).
