import { BadRequestException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { inflateRawSync } from 'node:zlib';

export const MAX_IMPORT_ROWS = 1000;
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
export const HEADERS = ['no_pelanggan', 'nama_pelanggan', 'username', 'password', 'paket', 'router_id', 'area_id', 'odp_id', 'no_wa', 'no_ktp', 'alamat', 'jenis_langganan', 'tanggal_tagihan', 'diskon', 'aktif', 'berlaku_sampai', 'tanggal_registrasi', 'catatan'] as const;
export type BackupRow = Record<typeof HEADERS[number], string>;
export type ParsedRow = { row: number; data: BackupRow };

export function table(workbook: ExcelJS.Workbook, name: string, headers: readonly string[], rows: string[][]) {
  const sheet = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = headers.map(header => ({ header, width: header === 'alamat' || header === 'catatan' ? 40 : 24, style: { numFmt: '@' } }));
  sheet.addRows(rows);
  sheet.getRow(1).eachCell(cell => { cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }; });
  sheet.autoFilter = { from: 'A1', to: { row: Math.max(1, sheet.rowCount), column: headers.length } };
  return sheet;
}

// Bound declared expanded archive size before handing the XLSX ZIP to ExcelJS.
function checkArchive(buffer: Buffer) {
  if (buffer.length > MAX_IMPORT_BYTES || buffer.length < 22 || buffer.readUInt32LE(0) !== 0x04034b50) throw new BadRequestException('Gunakan file .xlsx maksimal 5 MB.');
  let end = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) if (buffer.readUInt32LE(i) === 0x06054b50 && i + 22 + buffer.readUInt16LE(i + 20) === buffer.length) { end = i; break; }
  if (end < 0) throw new BadRequestException('Arsip Excel tidak valid.');
  const count = buffer.readUInt16LE(end + 10); let at = buffer.readUInt32LE(end + 16), total = 0;
  const directoryStart = at;
  if (count > 500 || at >= end) throw new BadRequestException('Struktur Excel terlalu besar.');
  for (let i = 0; i < count; i++) {
    if (at + 46 > end || buffer.readUInt32LE(at) !== 0x02014b50) throw new BadRequestException('Arsip Excel tidak valid.');
    const size = buffer.readUInt32LE(at + 24), length = buffer.readUInt16LE(at + 28), extra = buffer.readUInt16LE(at + 30), comment = buffer.readUInt16LE(at + 32);
    total += size;
    const name = buffer.subarray(at + 46, at + 46 + length).toString('utf8');
    if (total > 50 * 1024 * 1024 || size > 20 * 1024 * 1024 || /vbaProject|externalLinks|embeddings/i.test(name)) throw new BadRequestException('Excel terlalu besar atau mengandung objek yang tidak didukung.');
    const compressedSize = buffer.readUInt32LE(at + 20), method = buffer.readUInt16LE(at + 10), offset = buffer.readUInt32LE(at + 42);
    if (offset + 30 > directoryStart || buffer.readUInt32LE(offset) !== 0x04034b50 || (buffer.readUInt16LE(at + 8) & 1)) throw new BadRequestException('Arsip Excel tidak valid atau terenkripsi.');
    const start = offset + 30 + buffer.readUInt16LE(offset + 26) + buffer.readUInt16LE(offset + 28);
    if (start + compressedSize > directoryStart) throw new BadRequestException('Arsip Excel tidak valid.');
    try {
      const packed = buffer.subarray(start, start + compressedSize);
      const expanded = method === 0 ? packed : method === 8 ? inflateRawSync(packed, { maxOutputLength: Math.max(1, size + 1) }) : null;
      if (!expanded || expanded.length !== size) throw new Error();
    } catch { throw new BadRequestException('Data arsip Excel tidak valid atau melebihi batas ukuran.'); }
    at += 46 + length + extra + comment;
  }
  if (at !== end) throw new BadRequestException('Struktur arsip Excel tidak didukung.');
}

export async function parseWorkbook(buffer?: Buffer): Promise<ParsedRow[]> {
  if (!buffer) throw new BadRequestException('Pilih file Excel .xlsx terlebih dahulu.');
  checkArchive(buffer);
  const workbook = new ExcelJS.Workbook();
  try { await workbook.xlsx.load(buffer as never); } catch { throw new BadRequestException('File Excel tidak dapat dibaca. Gunakan template .xlsx.'); }
  const sheet = workbook.getWorksheet('Akun PPPoE');
  if (!sheet || sheet.rowCount > MAX_IMPORT_ROWS + 1) throw new BadRequestException(`Gunakan sheet Akun PPPoE dengan maksimal ${MAX_IMPORT_ROWS} baris data.`);
  const text = (value: ExcelJS.CellValue, row: number): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' && Number.isSafeInteger(value)) return String(value);
    if (value instanceof Date) return value.toISOString();
    throw new BadRequestException(`Baris ${row}: gunakan teks atau bilangan bulat, tanpa formula, hyperlink, atau objek.`);
  };
  if (HEADERS.some((header, i) => text(sheet.getRow(1).getCell(i + 1).value, 1) !== header) || sheet.columnCount > HEADERS.length) throw new BadRequestException('Nama dan urutan kolom harus sesuai template.');
  const rows: ParsedRow[] = [];
  for (let i = 2; i <= sheet.rowCount; i++) {
    const values = HEADERS.map((_, column) => text(sheet.getRow(i).getCell(column + 1).value, i));
    if (values.every(value => !value)) continue;
    rows.push({ row: i, data: Object.fromEntries(HEADERS.map((key, column) => [key, values[column]])) as BackupRow });
  }
  if (!rows.length) throw new BadRequestException('Sheet Akun PPPoE masih kosong. Isi mulai baris 2.');
  return rows;
}
