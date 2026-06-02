import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import { shopMiddleware } from "./prisma/shop.middleware";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());
  app.use(shopMiddleware);
  app.setGlobalPrefix("api");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
    credentials: true,
  });

  // Railway (and most PaaS) inject PORT; fall back to API_PORT for local dev.
  const port = Number(process.env.PORT ?? process.env.API_PORT ?? 4000);
  // Bind IPv6 "::" (dual-stack: also accepts IPv4). Railway's PRIVATE network is
  // IPv6-only, so listening on 0.0.0.0 would make the service unreachable over
  // <service>.railway.internal — required for web→api private networking.
  await app.listen(port, "::");
  console.log(`LGY API listening on port ${port}`);
}

bootstrap();
