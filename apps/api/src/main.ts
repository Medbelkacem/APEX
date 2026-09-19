import { Logger as NestLogger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createNestApp } from './create-app';
import { AppConfig } from './config/app.config';

async function bootstrap(): Promise<void> {
  const app = await createNestApp();
  const appCfg = app.get(ConfigService).get<AppConfig>('app')!;
  const docsEnabled = appCfg.env !== 'production' || appCfg.apiDocsEnabled;

  await app.listen(appCfg.port);
  new NestLogger('Bootstrap').log(
    `API listening on ${appCfg.apiUrl}${docsEnabled ? ` (docs at ${appCfg.apiUrl}/docs)` : ''}`,
  );
}

void bootstrap();
