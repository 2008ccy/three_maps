import { writeFileSync } from 'node:fs';
import nextEnv from '@next/env';

// Match Next's production .env loading even when this script runs as a separate
// process after `next build`. Only publish the boolean, never the endpoint or
// credentials, so static checks can follow the actual build configuration.
nextEnv.loadEnvConfig(process.cwd(), false);

// 必须在环境变量载入之后再导入：feedbackService 在模块初始化时读取配置，
// 静态 import 会被提升到 loadEnvConfig 之前执行，导致永远读到空值。
// feedbackService 就是运行时真正使用的配置：WorkBuddy 云数据库优先，
// 未配置时才退回自建 HTTP 接口，因此这里直接沿用，避免两套判断漂移。
const { feedbackService } = await import('../src/lib/feedback-client.ts');
const feedbackConfigured = feedbackService.configured;

writeFileSync('out/.site-build.json', JSON.stringify({
  basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? '',
  feedbackConfigured,
}));
writeFileSync('out/.nojekyll', '');
