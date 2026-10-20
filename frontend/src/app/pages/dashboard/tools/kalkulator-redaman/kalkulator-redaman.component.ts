import { Component, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';

const ratios: Record<string, number[]> = {
  '70:30': [70, 30],
  '80:20': [80, 20],
  '90:10': [90, 10],
};

@Component({
  selector: 'app-kalkulator-redaman',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './kalkulator-redaman.component.html',
})
export class KalkulatorRedamanComponent {
  source = signal<number | null>(null);
  distance = signal<number | null>(null);
  splitter = signal('1:2');
  path = signal('70');
  connectors = signal<number | null>(2);
  connectorLoss = signal<number | null>(0.5);
  cablePerKm = signal<number | null>(0.35);

  readonly splitterOptions = ['1:2', '1:4', '1:8', '70:30', '80:20', '90:10'];

  currentRatios = computed(() => ratios[this.splitter()] ?? null);

  onSplitterChange(value: string): void {
    this.splitter.set(value);
    const r = ratios[value];
    if (r) {
      this.path.set(String(r[0]));
    }
  }

  result = computed(() => {
    const asymmetric = ratios[this.splitter()];
    const percentage = Number(this.path());
    const splitterLoss = asymmetric
      ? -10 * Math.log10(percentage / 100)
      : 10 * Math.log10(Number(this.splitter().replace('1:', '')));

    const cable = (this.nonNegative(this.distance()) / 1000) * this.nonNegative(this.cablePerKm());
    const connector = this.nonNegative(this.connectors()) * this.nonNegative(this.connectorLoss());
    const source = this.source();
    const redaman = source === null || !Number.isFinite(source)
      ? NaN : source - splitterLoss - cable - connector - 1;

    return { splitterLoss, cable, connector, redaman };
  });

  private nonNegative(value: number | null): number {
    return value !== null && Number.isFinite(value) && value >= 0 ? value : NaN;
  }

  show(n: number, d = 2): string {
    return Number.isFinite(n) ? n.toFixed(d).replace('.', ',') : '-';
  }
}
