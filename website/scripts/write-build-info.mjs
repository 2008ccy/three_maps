import { writeFileSync } from 'node:fs';
writeFileSync('out/.site-build.json', JSON.stringify({ basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? '' }));
writeFileSync('out/.nojekyll', '');
