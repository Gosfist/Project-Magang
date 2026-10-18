import { Injectable } from '@nestjs/common';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { createSocket } from 'node:dgram';
import { isIPv4 } from 'node:net';

export interface DisconnectTarget {
  host: string; port: number; secret: string; username: string;
  sessionId?: string; nasAddress?: string;
}
export interface DisconnectReply { acknowledged: boolean; errorCause?: number }
const attribute = (type: number, value: Buffer) => {
  if (!value.length || value.length > 253) throw new Error('Atribut RADIUS tidak valid.');
  return Buffer.concat([Buffer.from([type, value.length + 2]), value]);
};
const integer = (value: number) => { const bytes = Buffer.alloc(4); bytes.writeUInt32BE(value); return bytes; };

// RFC 5176 sections 2.3 and 3.4. No RouterOS commands or login credentials.
export function disconnectPacket(target: DisconnectTarget, identifier = randomBytes(1)[0], now = Date.now()) {
  const attrs = [attribute(1, Buffer.from(target.username, 'utf8'))];
  if (target.sessionId) attrs.push(attribute(44, Buffer.from(target.sessionId, 'utf8')));
  if (target.nasAddress && isIPv4(target.nasAddress)) attrs.push(attribute(4, Buffer.from(target.nasAddress.split('.').map(Number))));
  attrs.push(attribute(55, integer(Math.floor(now / 1000))));
  attrs.push(attribute(80, Buffer.alloc(16)));
  const packet = Buffer.concat([Buffer.alloc(20), ...attrs]);
  packet[0] = 40; packet[1] = identifier; packet.writeUInt16BE(packet.length, 2);
  createHmac('md5', target.secret).update(packet).digest().copy(packet, packet.length - 16);
  createHash('md5').update(packet).update(target.secret, 'utf8').digest().copy(packet, 4);
  return packet;
}

export function disconnectReply(message: Buffer, request: Buffer, secret: string): DisconnectReply | null {
  if (message.length < 20 || ![41, 42].includes(message[0]) || message[1] !== request[1]) return null;
  const length = message.readUInt16BE(2);
  if (length < 20 || length > 4096 || length > message.length) return null;
  const packet = Buffer.from(message.subarray(0, length));
  const expected = createHash('md5').update(packet.subarray(0, 4)).update(request.subarray(4, 20)).update(packet.subarray(20)).update(secret, 'utf8').digest();
  if (!timingSafeEqual(expected, packet.subarray(4, 20))) return null;
  let errorCause: number | undefined, macOffset: number | undefined;
  for (let offset = 20; offset < length;) {
    if (offset + 2 > length) return null;
    const size = packet[offset + 1];
    if (size < 2 || offset + size > length) return null;
    if (packet[offset] === 101) { if (size !== 6) return null; errorCause = packet.readUInt32BE(offset + 2); }
    if (packet[offset] === 80) { if (size !== 18 || macOffset !== undefined) return null; macOffset = offset + 2; }
    offset += size;
  }
  if (macOffset !== undefined) {
    const actual = Buffer.from(packet.subarray(macOffset, macOffset + 16));
    request.copy(packet, 4, 4, 20); packet.fill(0, macOffset, macOffset + 16);
    if (!timingSafeEqual(actual, createHmac('md5', secret).update(packet).digest())) return null;
  }
  return { acknowledged: message[0] === 41, ...(errorCause !== undefined ? { errorCause } : {}) };
}

@Injectable()
export class RadiusDisconnectService {
  private active = 0;
  private waiting: (() => void)[] = [];
  async disconnect(target: DisconnectTarget, timeoutMs = 1500, attempts = 3): Promise<DisconnectReply> {
    if (!isIPv4(target.host) || !target.secret || !Number.isInteger(target.port) || target.port < 1 || target.port > 65535) throw new Error('Alamat, port, atau shared secret Disconnect NAS belum valid.');
    if (target.nasAddress && !isIPv4(target.nasAddress)) throw new Error('Identitas NAS Disconnect harus IPv4.');
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10000 || !Number.isInteger(attempts) || attempts < 1 || attempts > 5) throw new Error('Batas waktu atau percobaan Disconnect tidak valid.');
    if (this.active >= 8) {
      if (this.waiting.length >= 256) throw new Error('Antrean Disconnect RADIUS penuh; permintaan akan dicoba ulang.');
      await new Promise<void>(resolve => this.waiting.push(resolve));
    } else this.active++;
    try { return await this.send(target, timeoutMs, attempts); }
    finally { const next = this.waiting.shift(); if (next) next(); else this.active--; }
  }
  private send(target: DisconnectTarget, timeoutMs: number, attempts: number): Promise<DisconnectReply> {
    const packet = disconnectPacket(target);
    return new Promise((resolve, reject) => {
      const socket = createSocket('udp4');
      let timer: ReturnType<typeof setTimeout> | undefined;
      let finished = false, sent = 0;
      const finish = (error?: Error, reply?: DisconnectReply) => {
        if (finished) return;
        finished = true; if (timer) clearTimeout(timer);
        try { socket.close(); } catch { /* Bind can fail before opening. */ }
        if (error) reject(error); else resolve(reply!);
      };
      socket.on('error', () => finish(new Error('Koneksi UDP Disconnect NAS gagal. Periksa VPN, rute dan firewall.')));
      socket.on('message', (message, remote) => {
        if (remote.address !== target.host || remote.port !== target.port) return;
        const reply = disconnectReply(message, packet, target.secret);
        if (reply) finish(undefined, reply);
      });
      const send = () => {
        if (finished) return;
        if (sent++ >= attempts) return finish(new Error('Disconnect RADIUS timeout. Periksa VPN, shared secret dan firewall UDP tujuan NAS.'));
        socket.send(packet, target.port, target.host, error => { if (error) finish(new Error('Pengiriman Disconnect RADIUS gagal.')); });
        timer = setTimeout(send, timeoutMs);
      };
      const source = process.env.RADIUS_DISCONNECT_SOURCE_IP;
      if (source && !isIPv4(source)) return finish(new Error('RADIUS_DISCONNECT_SOURCE_IP harus IPv4 server lokal.'));
      socket.bind(0, source || '0.0.0.0', send);
    });
  }
}
