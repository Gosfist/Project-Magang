import { Component, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';

const ratios: Record<string, number[]> = {
  '70:30': [70, 30],
  '80:20': [80, 20],
  '90:10': [90, 10],
};

@Component({
  selector: 'app-attenuation-calculator',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './attenuation-calculator.component.html',
})
export class AttenuationCalculatorComponent {
  source = '';
  distance = '';
  splitter = '1:2';
  path = '70';
  connectors = '2';
  connectorLoss = '0.5';
  cablePerKm = '0.35';

  readonly splitterOptions = ['1:2', '1:4', '1:8', '70:30', '80:20', '90:10'];

  currentRatios = computed(() => ratios[this.splitter] ?? null);

  onSplitterChange(value: string): void {
    const r = ratios[value];
    if (r) {
      this.path = String(r[0]);
    }
  }

  result = computed(() => {
    const asymmetric = ratios[this.splitter];
    const percentage = Number(this.path);
    const splitterLoss = asymmetric
      ? -10 * Math.log10(percentage / 100)
      : 10 * Math.log10(Number(this.splitter.replace('1:', '')));

    const cable =
      this.distance === '' ? NaN : (Number(this.distance) / 1000) * Number(this.cablePerKm);
    const connector = Number(this.connectors) * Number(this.connectorLoss);
    const redaman =
      this.source === '' ? NaN : Number(this.source) - splitterLoss - cable - connector - 1;

    return { splitterLoss, cable, connector, redaman };
  });

  show(n: number, d = 2): string {
    return Number.isFinite(n) ? n.toFixed(d).replace('.', ',') : '-';
  }
}
