export const OPTICAL_DEFAULTS = {
  connectors: 2,
  connectorLoss: 0.5,
  cablePerKm: 0.35,
  safetyMargin: 1,
} as const;

export interface OpticalParent {
  type: string;
  redamanIn: number | null;
  outputCount: number;
  rasioRedamanPorts: Record<string, string>;
}

// redamanIn is the legacy API field for optical power in dBm, not loss in dB.
export function estimateInputPower(parent: OpticalParent, distance: number, port: string): string {
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
  const cableLoss = distance / 1000 * OPTICAL_DEFAULTS.cablePerKm;
  const connectorLoss = OPTICAL_DEFAULTS.connectors * OPTICAL_DEFAULTS.connectorLoss;
  return (parent.redamanIn - splitterLoss - cableLoss - connectorLoss - OPTICAL_DEFAULTS.safetyMargin).toFixed(2);
}
