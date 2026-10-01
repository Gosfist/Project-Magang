import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { MODULE_METADATA, PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { AppModule } from './app.module.js';
import { PrismaService } from './prisma/prisma.service.js';
import { PppoeModule } from './pppoe/pppoe.module.js';
import { RouterModule } from './router/router.module.js';
import { FinanceModule } from './finance/finance.module.js';
import { MonitoringModule } from './monitoring/monitoring.module.js';
import { MainCoreModule } from './main-core/main-core.module.js';

describe('feature folder wiring', () => {
  it('resolves all controllers and services after splitting feature modules', async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService).useValue({}).compile();
    expect(module).toBeDefined();
    await module.close();
  });

  it('registers every split controller without duplicate HTTP routes', () => {
    const routes: string[] = [];
    for (const module of [PppoeModule, RouterModule, FinanceModule, MonitoringModule, MainCoreModule]) {
      const controllers = Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, module);
      for (const controller of controllers) {
        const prefix = Reflect.getMetadata(PATH_METADATA, controller);
        for (const name of Object.getOwnPropertyNames(controller.prototype)) {
          const method = controller.prototype[name];
          const verb = Reflect.getMetadata(METHOD_METADATA, method);
          if (verb === undefined) continue;
          const suffix = Reflect.getMetadata(PATH_METADATA, method);
          routes.push(`${verb}:${prefix}/${suffix}`.replace(/\/+$/, ''));
        }
      }
    }
    expect(new Set(routes).size).toBe(routes.length);
    expect(routes).toContain('0:pppoe/accounts');
    expect(routes).toContain('0:pppoe/packages');
    expect(routes).toContain('0:pppoe/ip-pools');
    expect(routes).toContain('0:router/vpn-server');
    expect(routes).toContain('0:router/vpn-client');
    expect(routes).toContain('0:finance/summary');
    expect(routes).toContain('0:finance/deposits/invoices');
    expect(routes).toContain('0:monitoring/radius/logs');
    for (const type of ['server', 'rasio', 'odc', 'odp']) {
      expect(routes).toContain(`0:main-core/${type}`);
      expect(routes).toContain(`0:main-core/${type}/parents`);
    }
    expect(routes).toContain('0:main-core/trace');
  });
});
