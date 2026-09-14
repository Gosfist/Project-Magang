import net from 'node:net';
import tls from 'node:tls';

// RouterOS 6.43+ sentence protocol, including !empty replies introduced in 7.18.
// https://help.mikrotik.com/docs/spaces/ROS/pages/47579160/API
export function encodeSentence(words: string[]): Buffer {
  const parts: Buffer[] = [];
  for (const word of words) {
    const bytes = Buffer.from(word);
    const length = bytes.length;
    if (length > 0x1fffff) throw new Error('API word terlalu panjang.');
    const prefix = length < 0x80 ? Buffer.from([length])
      : length < 0x4000 ? Buffer.from([(length >> 8) | 0x80, length & 255])
      : Buffer.from([(length >> 16) | 0xc0, (length >> 8) & 255, length & 255]);
    parts.push(prefix, bytes);
  }
  return Buffer.concat([...parts, Buffer.from([0])]);
}

export class SentenceDecoder {
  private buffer: Buffer = Buffer.alloc(0);
  private words: string[] = [];
  private size = 0;

  push(chunk: Buffer): string[][] {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    const sentences: string[][] = [];
    while (this.buffer.length) {
      const first = this.buffer[0];
      const prefix = first < 0x80 ? 1 : first < 0xc0 ? 2 : first < 0xe0 ? 3 : first < 0xf0 ? 4 : first === 0xf0 ? 5 : 0;
      if (!prefix) throw new Error('Respons API tidak valid.');
      if (this.buffer.length < prefix) break;
      let length = first & (prefix === 1 ? 0x7f : prefix === 2 ? 0x3f : prefix === 3 ? 0x1f : 0x0f);
      if (prefix === 5) length = 0;
      for (let i = 1; i < prefix; i++) length = length * 256 + this.buffer[i];
      if (length > 2 * 1024 * 1024) throw new Error('Respons API terlalu besar.');
      if (this.buffer.length < prefix + length) break;
      if (length) {
        this.size += length;
        if (this.size > 4 * 1024 * 1024 || this.words.length > 4096) throw new Error('Respons API terlalu besar.');
        this.words.push(this.buffer.subarray(prefix, prefix + length).toString());
      } else {
        if (this.words.length) sentences.push(this.words);
        this.words = [];
        this.size = 0;
      }
      this.buffer = this.buffer.subarray(prefix + length);
    }
    return sentences;
  }
}

export class RouterOsClient {
  private socket?: net.Socket;
  private pending?: { resolve: (rows: Record<string, string>[]) => void; reject: (error: Error) => void; rows: Record<string, string>[]; error?: Error };
  private closed = false;

  async connect(host: string, port: number): Promise<void> {
    const decoder = new SentenceDecoder();
    const socket = port === 8729 ? tls.connect({ host, port }) : net.createConnection({ host, port });
    this.socket = socket;
    socket.on('data', (chunk: Buffer) => {
      try {
        for (const sentence of decoder.push(chunk)) this.receive(sentence);
      } catch (error) {
        this.fail(error instanceof Error ? error : new Error('Respons API tidak valid.'));
        this.close();
      }
    });
    socket.on('error', (error) => this.fail(error));
    socket.on('close', () => {
      this.closed = true;
      this.fail(new Error('Koneksi API MikroTik ditutup.'));
    });
    await new Promise<void>((resolve, reject) => {
      const event = port === 8729 ? 'secureConnect' : 'connect';
      const cleanup = () => { socket.off('error', onError); socket.off('close', onClose); socket.off(event, onConnect); };
      const onError = (error: Error) => { cleanup(); reject(error); };
      const onClose = () => onError(new Error('Koneksi API MikroTik ditutup.'));
      const onConnect = () => { cleanup(); resolve(); };
      socket.once('error', onError);
      socket.once('close', onClose);
      socket.once(event, onConnect);
    });
  }

  write(command: string, words: string[] = []): Promise<Record<string, string>[]> {
    if (this.closed || !this.socket || this.socket.destroyed) return Promise.reject(new Error('Koneksi API MikroTik ditutup.'));
    if (this.pending) return Promise.reject(new Error('Perintah API harus dijalankan berurutan.'));
    const packet = encodeSentence([command, ...words]);
    return new Promise((resolve, reject) => {
      this.pending = { resolve, reject, rows: [] };
      this.socket!.write(packet);
    });
  }

  close(): void {
    this.closed = true;
    this.fail(new Error('Koneksi API MikroTik ditutup.'));
    this.socket?.destroy();
  }

  private fail(error: Error): void {
    const pending = this.pending;
    this.pending = undefined;
    pending?.reject(error);
  }

  private receive(sentence: string[]): void {
    const pending = this.pending;
    if (!pending) return;
    const row: Record<string, string> = {};
    for (const word of sentence.slice(1)) {
      const split = word.indexOf('=', 1);
      if (word.startsWith('=') && split > 1) row[word.slice(1, split)] = word.slice(split + 1);
    }
    switch (sentence[0]) {
      case '!re':
        if (pending.rows.length >= 10000) throw new Error('Terlalu banyak hasil API.');
        pending.rows.push(row);
        break;
      case '!empty': break;
      case '!trap': pending.error = new Error(row.message || 'Perintah API ditolak.'); break;
      case '!fatal': this.fail(new Error(row.message || 'Login API gagal.')); this.close(); break;
      case '!done':
        this.pending = undefined;
        if (pending.error) pending.reject(pending.error);
        else pending.resolve(row.ret ? [...pending.rows, row] : pending.rows);
        break;
      default: throw new Error('Respons API tidak dikenal.');
    }
  }
}
