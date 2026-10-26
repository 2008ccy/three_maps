const mapTitles = { domain: '领域地图', ecosystem: '生态地图', cognition: '认知地图' };

export function documentReturnTarget(pathname: string) {
  const [, root, section] = pathname.split('/');
  const title = root === 'docs' ? mapTitles[section as keyof typeof mapTitles] : undefined;
  return title ? { href: `/docs/${section}/`, title: `返回${title}` } : { href: '/', title: '返回首页' };
}

export const previousAppUrlKey = 'threeMapsPreviousUrl';

export function isAppUrl(value: unknown, origin: string, basePath: string) {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.origin === origin && (url.pathname === basePath || url.pathname.startsWith(`${basePath}/`));
  } catch {
    return false;
  }
}
