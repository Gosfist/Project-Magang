import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fsSize } from 'systeminformation';

const execFileAsync = promisify(execFile);

export async function readLocalDiskTotals(): Promise<{ total: number; used: number } | null> {
  let volumes: { id: string; total: number; used: number }[];
  if (process.platform === 'win32') {
    const { stdout } = await execFileAsync('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-Command',
      "@(Get-CimInstance Win32_LogicalDisk -Filter 'DriveType = 3' | Select-Object DeviceID,Size,FreeSpace) | ConvertTo-Json -Compress",
    ], { windowsHide: true, timeout: 15000 });
    const parsed = JSON.parse(stdout || '[]');
    const drives = Array.isArray(parsed) ? parsed : [parsed];
    volumes = drives.map((drive) => ({ id: drive.DeviceID, total: Number(drive.Size), used: Number(drive.Size) - Number(drive.FreeSpace) }));
  } else {
    const filesystems = await fsSize();
    volumes = filesystems.filter((volume) => volume.fs.startsWith('/dev/') || (volume.mount === '/' && volume.type === 'overlay'))
      .map((volume) => ({ id: volume.fs, total: volume.size, used: volume.used }));
  }
  const unique = new Map(volumes.filter((volume) => Number.isFinite(volume.total) && volume.total > 0 && Number.isFinite(volume.used)).map((volume) => [volume.id, volume]));
  if (!unique.size) return null;
  return [...unique.values()].reduce((sum, volume) => ({ total: sum.total + volume.total, used: sum.used + Math.max(0, Math.min(volume.total, volume.used)) }), { total: 0, used: 0 });
}
