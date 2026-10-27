export type HomePhase = 'intro' | 'revealing' | 'expanded';
export const HOME_SESSION_KEY = 'three-maps:home-expanded:v1';
export const HOME_REVEAL_MS = 900;

type SceneStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function restoreHomePhase(storage: SceneStorage): HomePhase {
  try { return storage.getItem(HOME_SESSION_KEY) === '1' ? 'expanded' : 'intro'; }
  catch { return 'intro'; }
}

export function rememberHomeExpanded(storage: SceneStorage): void {
  try { storage.setItem(HOME_SESSION_KEY, '1'); } catch { /* 无存储权限时仍能在本次浏览中展开。 */ }
}

export function isHomeRoute(pathname: string, basePath = ''): boolean {
  return pathname === '/' || (!!basePath && (pathname === basePath || pathname === `${basePath}/`));
}
