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

Raccourci dans l'app : `D` affiche ou masque l'overlay de debug (FPS, résolutions).

## Déploiement

Le workflow `.github/workflows/deploy.yml` publie sur GitHub Pages à chaque push sur `main` (activer Pages avec la source « GitHub Actions » dans les réglages du dépôt).
