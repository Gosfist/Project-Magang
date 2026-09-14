import net from 'node:net';
import type { Nas } from '@prisma/client';
import { MikrotikService } from './mikrotik.service.js';
import { encodeSentence, SentenceDecoder } from './routeros-client.js';

describe('RouterOS API integration with a local protocol server', () => {
  let server: net.Server;
  const sockets = new Set<net.Socket>();
  const commands: string[][] = [];
  let handle: (words: string[], socket: net.Socket) => void;
  let port: number;

  beforeEach(async () => {
    commands.length = 0;
    server = net.createServer((socket) => {
      sockets.add(socket);
      socket.on('close', () => sockets.delete(socket));
      const decoder = new SentenceDecoder();
      socket.on('data', (chunk: Buffer) => {
        for (const words of decoder.push(chunk)) { commands.push(words); handle(words, socket); }
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as net.AddressInfo).port;
  });
  afterEach(async () => {
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  const router = () => ({ ipAddress: '127.0.0.1', nasname: '127.0.0.1', username: 'admin', password: 'test=secret', port } as Nas);

  it('authenticates before executing a command and decodes fragmented responses', async () => {
    handle = (words, socket) => {
      if (words[0] === '/login') socket.write(encodeSentence(['!done']));
      else {
        const packet = Buffer.concat([encodeSentence(['!re', '=name=Lab=Jakarta']), encodeSentence(['!done'])]);
        socket.write(packet.subarray(0, 3));
        socket.write(packet.subarray(3));
      }
    };
    const rows = await new MikrotikService().withRouter(router(), (write) => write('/system/identity/print'));
    expect(commands[0]).toEqual(['/login', '=name=admin', '=password=test=secret']);
    expect(rows).toEqual([{ name: 'Lab=Jakarta' }]);
  });

  it('rejects incorrect credentials even when TCP is open', async () => {
    handle = (_, socket) => socket.write(Buffer.concat([
      encodeSentence(['!trap', '=message=invalid user name or password']), encodeSentence(['!done']),
    ]));
    await expect(new MikrotikService().withRouter(router(), (write) => write('/system/identity/print'))).rejects.toThrow('Login API MikroTik gagal');
    expect(commands).toHaveLength(1);
  });

  it('accepts RouterOS 7.18 empty results and command return IDs', async () => {
    handle = (words, socket) => socket.write(Buffer.concat(words[0] === '/login'
      ? [encodeSentence(['!done'])]
      : words[0].endsWith('/print')
        ? [encodeSentence(['!empty']), encodeSentence(['!done'])]
        : [encodeSentence(['!done', '=ret=*A'])]));
    await new MikrotikService().withRouter(router(), async (write) => {
      expect(await write('/ip/pool/print')).toEqual([]);
      expect(await write('/ip/pool/add', ['=name=pool'])).toEqual([{ ret: '*A' }]);
    });
  });

  it('reports a dropped connection without hanging', async () => {
    handle = (_, socket) => socket.destroy();
    await expect(new MikrotikService().withRouter(router(), (write) => write('/system/identity/print'))).rejects.toThrow();
  });

  it('closes a TCP connection that never answers login within the deadline', async () => {
    handle = () => {};
    await expect(new MikrotikService().withRouter(router(), (write) => write('/system/identity/print'), 50)).rejects.toThrow('timeout');
    expect(commands).toHaveLength(1);
  });

  it('does not swallow RouterOS permission errors', async () => {
    handle = (words, socket) => socket.write(Buffer.concat(words[0] === '/login'
      ? [encodeSentence(['!done'])]
      : [encodeSentence(['!trap', '=message=not enough permissions']), encodeSentence(['!done'])]));
    await expect(new MikrotikService().withRouter(router(), (write) => write('/ip/pool/add'))).rejects.toThrow('not enough permissions');
  });

  it('decodes multi-byte UTF-8 words across every packet boundary', () => {
    const sentence = ['!re', '=name=' + 'é'.repeat(9000)];
    const decoder = new SentenceDecoder();
    const packet = encodeSentence(sentence);
    const result: string[][] = [];
    for (let i = 0; i < packet.length; i += 7) result.push(...decoder.push(packet.subarray(i, i + 7)));
    expect(result).toEqual([sentence]);
  });
});
