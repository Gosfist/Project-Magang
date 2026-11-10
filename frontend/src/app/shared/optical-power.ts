export interface OpticalParent {
  type: string;
  redamanIn: number | null;
  outputCount: number;
  rasioRedamanPorts: Record<string, string>;
}

// redamanIn is the legacy API field for optical power in dBm, not loss in dB.
export function estimateInputPower(parent: OpticalParent, distance: number, port: string, target: 'rasio' | 'odc' | 'odp'): string {
  if (parent.redamanIn === null || !Number.isFinite(parent.redamanIn) || !Number.isFinite(distance) || distance < 0) return '';
  let splitterLoss = 0;
  if (parent.type !== 'server') {
    if (!Number.isInteger(parent.outputCount) || parent.outputCount < 1) return '';
    const output = Number(port);
    if (!Number.isInteger(output) || output < 1 || output > parent.outputCount) return '';
    if (parent.type === 'rasio') {
      const percentage = Number((parent.rasioRedamanPorts[port] ?? '').replace('%', '').replace(',', '.'));
      if (!(percentage > 0 && percentage <= 100)) return '';
      splitterLoss = -10 * Math.log10(percentage / 100);
    } else {
      splitterLoss = 10 * Math.log10(parent.outputCount);
    }
  }
  const cableLoss = distance / 1000 * 0.35;
  const connectorLoss = target === 'odp' && parent.type === 'odc' ? 1 : 0;
  return (parent.redamanIn - splitterLoss - cableLoss - connectorLoss - 1).toFixed(2);
}
