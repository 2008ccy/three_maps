export const appName = '三张活地图';
export const docsRoute = '/docs';
export const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
export const withBasePath = (path: string) => `${basePath}${path}`;
export const gitConfig = { user: '2008ccy', repo: 'three_maps', branch: 'main' };
