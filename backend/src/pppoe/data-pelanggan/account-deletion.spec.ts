import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { DataPelangganService } from './data-pelanggan.service.js';
import { DataPelangganController } from './data-pelanggan.controller.js';
import { PsbService } from '../../psb/psb.service.js';
import { PsbController } from '../../psb/psb.controller.js';
import { RequestMethod } from '@nestjs/common';
describe('permanent customer records', () => {
  it('exposes no delete customer or registration service and HTTP handler', () => {
    expect('removeAccount' in DataPelangganService.prototype).toBe(false);
    expect('remove' in PsbService.prototype).toBe(false);
    for (const controller of [DataPelangganController, PsbController]) {
      for (const name of Object.getOwnPropertyNames(controller.prototype).filter(name => name !== 'constructor')) {
        expect(Reflect.getMetadata('method', controller.prototype[name])).not.toBe(RequestMethod.DELETE);
      }
    }
  });
});
