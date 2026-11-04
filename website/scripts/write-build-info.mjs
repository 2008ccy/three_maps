import { writeFileSync } from 'node:fs';
import nextEnv from '@next/env';
import { feedbackServiceConfig } from '../src/lib/feedback-client.ts';

// Match Next's production .env loading even when this script runs as a separate
// process after `next build`. Only publish the boolean, never the endpoint or
// credentials, so static checks can follow the actual build configuration.
nextEnv.loadEnvConfig(process.cwd(), false);
const { configured: feedbackConfigured } = feedbackServiceConfig(
  process.env.NEXT_PUBLIC_FEEDBACK_API_BASE_URL,
  process.env.NEXT_PUBLIC_FEEDBACK_SERVICE_VERIFIED,
);
writeFileSync('out/.site-build.json', JSON.stringify({
  basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? '',
  feedbackConfigured,
}));
writeFileSync('out/.nojekyll', '');
