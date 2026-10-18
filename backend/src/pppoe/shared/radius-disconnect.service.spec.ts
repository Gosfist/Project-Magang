import 'reflect-metadata';
import { createHash, createHmac } from 'node:crypto';
import { createSocket, type RemoteInfo, type Socket } from 'node:dgram';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { disconnectPacket, disconnectReply, RadiusDisconnectService, type DisconnectTarget } from './radius-disconnect.service.js';

const fixture: DisconnectTarget = { host: '127.0.0.1', port: 3799, secret: 'testing123', username: 'alice', sessionId: 'c0ffee', nasAddress: '10.10.1.2' };
// Independent Python hashlib/hmac + struct !BBH/!I vector, timestamp 1700000000.
const knownPacketHex = '2807004126525f8949735e5da0cfc015a1a11f460107616c6963652c0863306666656504060a0a010237066553f10050124a7fc4f724e6074314222455a3d1e8c4';
const request = Buffer.from(knownPacketHex, 'hex');

// Minimal NAS fixture, deliberately independent from production request/reply construction.
function nasReply(requestBytes: Buffer, code = 41, attrs = Buffer.alloc(0), withMac = false, secret = fixture.secret): Buffer {
  const header = Buffer.alloc(20);
  header[0] = code;
  header[1] = requestBytes[1];
  requestBytes.subarray(4, 20).copy(header, 4);
  const packet = Buffer.concat([header, attrs, ...(withMac ? [Buffer.from([80, 18]), Buffer.alloc(16)] : [])]);
  packet.writeUInt16BE(packet.length, 2);
  if (withMac) createHmac('md5', secret).update(packet).digest().copy(packet, packet.length - 16);
  return signResponse(packet, requestBytes, secret);
}

function signResponse(packet: Buffer, requestBytes = request, secret = fixture.secret) {
  const signed = Buffer.from(packet);
  requestBytes.subarray(4, 20).copy(signed, 4);
  createHash('md5').update(Buffer.concat([signed, Buffer.from(secret)])).digest().copy(signed, 4);
  return signed;
}

function errorAttribute(code: number) {
  const attr = Buffer.from([101, 6, 0, 0, 0, 0]);
  attr.writeUInt32BE(code, 2);
  return attr;
}

const sockets: Socket[] = [];
async function listen(address = '127.0.0.1', port = 0) {
  const socket = createSocket('udp4');
  sockets.push(socket);
  await new Promise<void>((resolve, reject) => { socket.once('error', reject); socket.bind(port, address, () => { socket.off('error', reject); resolve(); }); });
  const info = socket.address();
  return { socket, host: address, port: info.port };
}
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(sockets.splice(0).map(socket => new Promise<void>(resolve => { try { socket.close(() => resolve()); } catch { resolve(); } })));
});

describe('RADIUS Disconnect RFC 5176 wire format', () => {
  it('matches independently calculated packet, HMAC and Request Authenticator bytes', () => {
    const packet = disconnectPacket(fixture, 7, 1700000000000);
    expect(packet.toString('hex')).toBe(knownPacketHex);
    expect(packet.readUInt16BE(2)).toBe(packet.length);
    expect(packet.subarray(4, 20).toString('hex')).toBe('26525f8949735e5da0cfc015a1a11f46');
    expect(packet.subarray(-16).toString('hex')).toBe('4a7fc4f724e6074314222455a3d1e8c4');
  });

  it('supports username-only selectors and rejects empty/overlong text attributes', () => {
    expect(disconnectPacket({ ...fixture, sessionId: undefined, nasAddress: undefined }, 8, 1700000000000)[0]).toBe(40);
    expect(() => disconnectPacket({ ...fixture, username: '' })).toThrow('Atribut RADIUS');
    expect(() => disconnectPacket({ ...fixture, username: 'x'.repeat(254) })).toThrow('Atribut RADIUS');
    expect(() => disconnectPacket({ ...fixture, sessionId: 'x'.repeat(254) })).toThrow('Atribut RADIUS');
  });

  it('accepts authenticated ACK and NAK with optional Message-Authenticator', () => {
    expect(disconnectReply(nasReply(request), request, fixture.secret)).toEqual({ acknowledged: true });
    expect(disconnectReply(nasReply(request, 41, Buffer.alloc(0), true), request, fixture.secret)).toEqual({ acknowledged: true });
    expect(disconnectReply(nasReply(request, 42, errorAttribute(503), true), request, fixture.secret)).toEqual({ acknowledged: false, errorCause: 503 });
  });

  it('rejects bad authenticator, secret, code, identifier, length and truncated replies', () => {
    const good = nasReply(request);
    const badAuth = Buffer.from(good); badAuth[4] ^= 0xff;
    const badId = Buffer.from(good); badId[1] ^= 1;
    const badCode = Buffer.from(good); badCode[0] = 44;
    const badLength = Buffer.from(good); badLength.writeUInt16BE(19, 2);
    const overLength = Buffer.from(good); overLength.writeUInt16BE(4097, 2);
    const truncatedLength = Buffer.from(good); truncatedLength.writeUInt16BE(good.length + 1, 2);
    for (const bad of [badAuth, badId, badCode, badLength, overLength, truncatedLength, good.subarray(0, 19)]) expect(disconnectReply(bad, request, fixture.secret)).toBeNull();
    expect(disconnectReply(good, request, 'wrong-secret')).toBeNull();
    const otherRequest = Buffer.from(request); otherRequest[4] ^= 1;
    expect(disconnectReply(good, otherRequest, fixture.secret)).toBeNull();
  });

  it('ignores authenticated UDP padding beyond the declared packet length', () => {
    expect(disconnectReply(Buffer.concat([nasReply(request), Buffer.from('padding')]), request, fixture.secret)).toEqual({ acknowledged: true });
  });

  it('rejects malformed attribute lengths even with a valid response authenticator', () => {
    for (const attrs of [Buffer.from([101]), Buffer.from([101, 0]), Buffer.from([101, 1]), Buffer.from([101, 6, 0]), Buffer.from([101, 3, 0]), Buffer.from([80, 3, 0]), Buffer.concat([Buffer.from([80, 18]), Buffer.alloc(16), Buffer.from([80, 18]), Buffer.alloc(16)])]) {
      expect(disconnectReply(nasReply(request, 42, attrs), request, fixture.secret)).toBeNull();
    }
  });

  it('rejects an incorrect Message-Authenticator after verifying a valid Response Authenticator', () => {
    const tampered = nasReply(request, 41, Buffer.alloc(0), true);
    tampered[tampered.length - 1] ^= 1;
    const responseWithValidMd5 = signResponse(tampered);
    expect(disconnectReply(responseWithValidMd5, request, fixture.secret)).toBeNull();
  });
});

describe('RADIUS Disconnect local UDP transport', () => {
  it.each([41, 42])('receives authenticated local UDP response code %i', async code => {
    const nas = await listen();
    nas.socket.on('message', (packet, remote) => nas.socket.send(nasReply(packet, code, code === 42 ? errorAttribute(503) : Buffer.alloc(0), true), remote.port, remote.address));
    const result = await new RadiusDisconnectService().disconnect({ ...fixture, port: nas.port }, 100, 2);
    expect(result).toEqual(code === 41 ? { acknowledged: true } : { acknowledged: false, errorCause: 503 });
  });

  it('retransmits identical identifier, authenticator and payload from the same source port', async () => {
    const nas = await listen();
    const packets: Buffer[] = [];
    const sourcePorts: number[] = [];
    nas.socket.on('message', (packet, remote) => {
      packets.push(Buffer.from(packet)); sourcePorts.push(remote.port);
      if (packets.length === 3) nas.socket.send(nasReply(packet), remote.port, remote.address);
    });
    const result = await new RadiusDisconnectService().disconnect({ ...fixture, port: nas.port }, 25, 3);
    expect(result.acknowledged).toBe(true);
    expect(packets).toHaveLength(3);
    expect(new Set(sourcePorts).size).toBe(1);
    expect(packets.every(packet => packet.equals(packets[0]))).toBe(true);
  });

  it('ignores validly signed replies from another UDP source port and bad auth from the actual NAS', async () => {
    const nas = await listen();
    const spoof = await listen();
    let packets = 0;
    nas.socket.on('message', (packet, remote) => {
      packets++;
      if (packets === 1) {
        spoof.socket.send(nasReply(packet), remote.port, remote.address);
        const bad = nasReply(packet); bad[4] ^= 1;
        nas.socket.send(bad, remote.port, remote.address);
      } else nas.socket.send(nasReply(packet, 42, errorAttribute(403)), remote.port, remote.address);
    });
    const result = await new RadiusDisconnectService().disconnect({ ...fixture, port: nas.port }, 30, 2);
    expect(packets).toBe(2);
    expect(result).toEqual({ acknowledged: false, errorCause: 403 });
  });

  it('times out with bounded retries then releases its concurrency slot', async () => {
    const nas = await listen();
    let count = 0;
    nas.socket.on('message', () => count++);
    const service = new RadiusDisconnectService();
    const started = performance.now();
    await expect(service.disconnect({ ...fixture, port: nas.port }, 20, 2)).rejects.toThrow('timeout');
    expect(count).toBe(2);
    expect(performance.now() - started).toBeLessThan(1500);
    expect((service as any).active).toBe(0);
    expect((service as any).waiting).toHaveLength(0);
  });

  it('ignores a correctly signed response from another source IP using the NAS port', async () => {
    const nas = await listen();
    const spoof = await listen('127.0.0.2', nas.port);
    let packets = 0;
    nas.socket.on('message', (packet, remote) => {
      packets++;
      if (packets === 1) spoof.socket.send(nasReply(packet), remote.port, remote.address);
      else nas.socket.send(nasReply(packet, 42, errorAttribute(403)), remote.port, remote.address);
    });
    const result = await new RadiusDisconnectService().disconnect({ ...fixture, port: nas.port }, 30, 2);
    expect(packets).toBe(2);
    expect(result).toEqual({ acknowledged: false, errorCause: 403 });
  });

  it('limits concurrent UDP requests to eight and drains queued callers', async () => {
    const nas = await listen();
    const observed: { packet: Buffer; remote: RemoteInfo }[] = [];
    nas.socket.on('message', (packet, remote) => observed.push({ packet, remote }));
    const service = new RadiusDisconnectService();
    const pending = Array.from({ length: 12 }, (_, index) => service.disconnect({ ...fixture, port: nas.port, username: `alice-${index}` }, 1000, 1));
    for (let n = 0; n < 30 && observed.length < 8; n++) await pause(5);
    expect(observed).toHaveLength(8);
    expect((service as any).active).toBe(8);
    expect((service as any).waiting).toHaveLength(4);
    for (const { packet, remote } of observed.splice(0)) nas.socket.send(nasReply(packet), remote.port, remote.address);
    for (let n = 0; n < 30 && observed.length < 4; n++) await pause(5);
    expect(observed).toHaveLength(4);
    for (const { packet, remote } of observed) nas.socket.send(nasReply(packet), remote.port, remote.address);
    expect((await Promise.all(pending)).every(reply => reply.acknowledged)).toBe(true);
    expect((service as any).active).toBe(0);
    expect((service as any).waiting).toHaveLength(0);
  });

  it('rejects invalid NAS and source addresses without leaving a concurrency slot occupied', async () => {
    const service = new RadiusDisconnectService();
    await expect(service.disconnect({ ...fixture, host: 'nas.example.test' })).rejects.toThrow('belum valid');
    await expect(service.disconnect({ ...fixture, port: 0 })).rejects.toThrow('belum valid');
    vi.stubEnv('RADIUS_DISCONNECT_SOURCE_IP', 'invalid-source');
    await expect(service.disconnect(fixture)).rejects.toThrow('harus IPv4');
    expect((service as any).active).toBe(0);
  });

  it('bounds its waiting queue and releases all slots after timed out callers', async () => {
    const nas = await listen();
    const service = new RadiusDisconnectService();
    const pending = Array.from({ length: 264 }, () => service.disconnect({ ...fixture, port: nas.port }, 20, 1).catch(error => error));
    expect((service as any).active).toBe(8);
    expect((service as any).waiting).toHaveLength(256);
    await expect(service.disconnect({ ...fixture, port: nas.port }, 20, 1)).rejects.toThrow('Antrean Disconnect RADIUS penuh');
    expect((await Promise.all(pending)).every(result => result instanceof Error && result.message.includes('timeout'))).toBe(true);
    expect((service as any).active).toBe(0);
    expect((service as any).waiting).toHaveLength(0);
  });

  it('rejects nonfinite, fractional or out-of-range retry settings before allocating a socket', async () => {
    const service = new RadiusDisconnectService();
    for (const timeoutMs of [0, -1, 1.5, NaN, Infinity, 10001]) await expect(service.disconnect(fixture, timeoutMs, 1)).rejects.toThrow('Batas waktu');
    for (const attempts of [0, -1, 1.5, NaN, Infinity, 6]) await expect(service.disconnect(fixture, 100, attempts)).rejects.toThrow('Batas waktu');
    await expect(service.disconnect({ ...fixture, nasAddress: 'invalid-address' })).rejects.toThrow('Identitas NAS');
    expect((service as any).active).toBe(0); expect((service as any).waiting).toHaveLength(0);
  });

  it('accepts the supported upper timeout and retry limits with a real local ACK', async () => {
    const nas = await listen();
    nas.socket.on('message', (packet, remote) => nas.socket.send(nasReply(packet), remote.port, remote.address));
    expect(await new RadiusDisconnectService().disconnect({ ...fixture, port: nas.port }, 10000, 5)).toEqual({ acknowledged: true });
  });
});
