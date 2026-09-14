import { Injectable } from '@nestjs/common';
import type { Nas } from '@prisma/client';
import { RouterOsClient } from './routeros-client.js';

export type RouterCommand = (command: string, words?: string[]) => Promise<Record<string, string>[]>;

@Injectable()
export class MikrotikService {
  async withRouter<T>(router: Nas, action: (write: RouterCommand) => Promise<T>, timeoutMs = 15000): Promise<T> {
    if (!router.username || router.password === null) {
      throw new Error('Username dan password API MikroTik belum dikonfigurasi.');
    }
    const api = new RouterOsClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let expired = false;
    try {
      return await Promise.race([
        (async () => {
          await api.connect(router.ipAddress || router.nasname, router.port || 8728);
          try {
            const reply = await api.write('/login', [`=name=${router.username}`, `=password=${router.password}`]);
            if (reply.some((row) => row.ret)) throw new Error('Login API lama tidak didukung.');
          }
          catch { throw new Error('Login API MikroTik gagal.'); }
          if (expired) throw new Error('Koneksi MikroTik melewati batas waktu.');
          return action(async (command, words = []) => {
            if (expired) throw new Error('Koneksi MikroTik melewati batas waktu.');
            return api.write(command, words);
          });
        })(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            expired = true;
            reject(new Error('Operasi API MikroTik timeout.'));
          }, timeoutMs);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
      expired = true;
      api.close();
    }
  }

  errorMessage(error: unknown): string {
    // Do not reflect RouterOS responses containing credentials into the UI.
    const message = error instanceof Error ? error.message : String(error);
    if (/password|login|auth|invalid user/i.test(message)) return 'Login API MikroTik gagal. Periksa username/password dan hak akses API.';
    if (/timeout|timed out/i.test(message)) return 'API MikroTik timeout. Periksa koneksi dan firewall.';
    if (/ECONNREFUSED/i.test(message)) return 'Port API MikroTik menolak koneksi.';
    if (/belum dikonfigurasi/i.test(message)) return 'Kredensial API MikroTik belum dikonfigurasi.';
    return 'Operasi API MikroTik gagal. Periksa koneksi, sertifikat, hak akses, dan konfigurasi router.';
  }
}
