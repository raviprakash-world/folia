import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { AppConfigService } from './config/app-config.service';

// Every JSON request body this API accepts is small (product/order/
// address payloads, a handful of KB at most) — the only genuinely large
// upload is the avatar endpoint, which uses its own separate multipart
// limit (auth.controller.ts's MAX_AVATAR_BYTES, 2MB, matching the
// frontend exactly) and isn't affected by this. An explicit limit here,
// rather than relying on Express's undocumented default, means a
// malicious or malformed oversized request is rejected immediately by
// the body parser instead of being fully buffered into memory first.
const JSON_BODY_LIMIT = '256kb';

async function bootstrap() {
  // bodyParser: false — disables Nest's internal Express body-parser
  // setup so the explicit json()/urlencoded() calls below (with a real
  // size limit) are the only ones registered, rather than running
  // alongside Nest's own default-configured one. Confirmed this
  // combination is necessary, not just adding limit-configured
  // middleware on top of the default, by checking
  // NestApplicationOptions' actual type definition directly.
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    bodyParser: false,
  });

  const config = app.get(AppConfigService);

  app.useLogger(app.get(Logger));
  app.use(helmet());
  app.use(cookieParser());
  app.use(json({ limit: JSON_BODY_LIMIT }));
  app.use(urlencoded({ extended: true, limit: JSON_BODY_LIMIT }));
  app.enableCors({ origin: config.corsOrigins, credentials: true });

  // Every route the frontend calls is prefixed with /api — matches the
  // frontend's existing apiClient.ts baseURL exactly, so the service layer
  // needs zero changes beyond pointing at a real host instead of MSW.
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Folia API')
    .setDescription('Folia e-commerce backend — REST API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(config.port);
}

void bootstrap();
