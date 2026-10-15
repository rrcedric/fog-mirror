import type { CameraErrorKind } from '../lib/camera/camera'

export type AppErrorKind = CameraErrorKind | 'webgl'

export const ERROR_MESSAGES: Record<AppErrorKind, { title: string; detail: string }> = {
  insecure: {
    title: 'Connexion non sécurisée',
    detail: 'La caméra n’est accessible que sur une page en HTTPS (ou sur localhost).',
  },
  unsupported: {
    title: 'Navigateur non compatible',
    detail:
      'Ce navigateur ne permet pas d’accéder à la caméra. Essayez Chrome, Edge, Firefox ou Safari.',
  },
  denied: {
    title: 'Accès à la caméra refusé',
    detail:
      'Autorisez la caméra dans les réglages du site (icône à gauche de l’adresse), puis réessayez.',
  },
  'not-found': {
    title: 'Aucune caméra trouvée',
    detail: 'Branchez une webcam, puis réessayez.',
  },
  'in-use': {
    title: 'Caméra indisponible',
    detail: 'Elle est peut-être utilisée par une autre application. Fermez-la, puis réessayez.',
  },
  ended: {
    title: 'La caméra s’est arrêtée',
    detail: 'Elle a peut-être été débranchée ou coupée. Réessayez pour la relancer.',
  },
  webgl: {
    title: 'Affichage 3D indisponible',
    detail:
      'Le miroir a besoin de WebGL2. Activez l’accélération matérielle du navigateur ou essayez un autre navigateur.',
  },
  unknown: {
    title: 'Impossible de démarrer la caméra',
    detail: 'Une erreur inattendue s’est produite. Réessayez.',
  },
}
