import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { AuditController } from "./audit.controller";
import { AuditService } from "./audit.service";
import { AuditInterceptor } from "./audit.interceptor";

/**
 * Registering the interceptor as APP_INTERCEPTOR makes it global AND lets it
 * inject PrismaService via DI (PrismaModule is @Global). Every mutating request
 * across both staff and admin controllers is audited.
 */
@Module({
  controllers: [AuditController],
  providers: [AuditService, { provide: APP_INTERCEPTOR, useClass: AuditInterceptor }],
})
export class AuditModule {}
