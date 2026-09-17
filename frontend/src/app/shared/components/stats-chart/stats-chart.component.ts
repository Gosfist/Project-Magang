import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

export interface ChartStatItem {
  timestamp: string;
  label: string;
  cpuPercent: number;
  memPercent: number;
  netDown: number;
  netUp: number;
}

@Component({
  selector: 'app-stats-chart',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './stats-chart.component.html',
  styleUrl: './stats-chart.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatsChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() title = 'Grafik';
  @Input() type: 'cpu' | 'ram' | 'network' = 'cpu';
  @Input() period: 'daily' | 'monthly' | 'yearly' = 'daily';
  @Input() items: ChartStatItem[] = [];
  @Input() loading = false;

  @Output() periodChange = new EventEmitter<'daily' | 'monthly' | 'yearly'>();

  @ViewChild('chartCanvas') chartCanvas?: ElementRef<HTMLCanvasElement>;

  private chartInstance: Chart | null = null;

  ngAfterViewInit(): void {
    this.renderChart();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['items'] || changes['type']) {
      this.renderChart();
    }
  }

  ngOnDestroy(): void {
    if (this.chartInstance) {
      this.chartInstance.destroy();
      this.chartInstance = null;
    }
  }

  onSelectPeriod(val: 'daily' | 'monthly' | 'yearly') {
    this.period = val;
    this.periodChange.emit(val);
  }

  get averageValue(): string {
    if (!this.items.length) return '0';
    if (this.type === 'cpu') {
      const avg = this.items.reduce((acc, i) => acc + i.cpuPercent, 0) / this.items.length;
      return `${avg.toFixed(1)}%`;
    }
    if (this.type === 'ram') {
      const avg = this.items.reduce((acc, i) => acc + i.memPercent, 0) / this.items.length;
      return `${avg.toFixed(1)}%`;
    }
    const avgDown = this.items.reduce((acc, i) => acc + i.netDown, 0) / this.items.length;
    const avgUp = this.items.reduce((acc, i) => acc + i.netUp, 0) / this.items.length;
    return `DL: ${avgDown.toFixed(2)} / UL: ${avgUp.toFixed(2)} Mbps`;
  }

  private renderChart(): void {
    if (!this.chartCanvas) return;
    if (this.chartInstance) {
      this.chartInstance.destroy();
      this.chartInstance = null;
    }

    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    const labels = this.items.map((i) => i.label);

    let datasets: any[] = [];

    if (this.type === 'cpu') {
      const gradient = ctx.createLinearGradient(0, 0, 0, 240);
      gradient.addColorStop(0, 'rgba(56, 189, 248, 0.4)');
      gradient.addColorStop(1, 'rgba(56, 189, 248, 0.0)');

      datasets = [
        {
          label: 'CPU (%)',
          data: this.items.map((i) => i.cpuPercent),
          borderColor: '#38bdf8',
          backgroundColor: gradient,
          fill: true,
          tension: 0.35,
          pointBackgroundColor: '#38bdf8',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ];
    } else if (this.type === 'ram') {
      const gradient = ctx.createLinearGradient(0, 0, 0, 240);
      gradient.addColorStop(0, 'rgba(168, 85, 247, 0.4)');
      gradient.addColorStop(1, 'rgba(168, 85, 247, 0.0)');

      datasets = [
        {
          label: 'RAM (%)',
          data: this.items.map((i) => i.memPercent),
          borderColor: '#a855f7',
          backgroundColor: gradient,
          fill: true,
          tension: 0.35,
          pointBackgroundColor: '#a855f7',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ];
    } else if (this.type === 'network') {
      datasets = [
        {
          label: 'Download (Mbps)',
          data: this.items.map((i) => i.netDown),
          borderColor: '#38bdf8',
          backgroundColor: 'rgba(56, 189, 248, 0.1)',
          fill: false,
          tension: 0.35,
          pointBackgroundColor: '#38bdf8',
          pointRadius: 4,
        },
        {
          label: 'Upload (Mbps)',
          data: this.items.map((i) => i.netUp),
          borderColor: '#f43f5e',
          backgroundColor: 'rgba(244, 63, 94, 0.1)',
          fill: false,
          tension: 0.35,
          pointBackgroundColor: '#f43f5e',
          pointRadius: 4,
        },
      ];
    }

    this.chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: {
            display: this.type === 'network',
            labels: {
              color: '#94a3b8',
              font: { size: 12 },
              usePointStyle: true,
            },
          },
          tooltip: {
            backgroundColor: '#0f172a',
            titleColor: '#f8fafc',
            bodyColor: '#cbd5e1',
            borderColor: '#334155',
            borderWidth: 1,
            padding: 10,
            cornerRadius: 8,
          },
        },
        scales: {
          x: {
            grid: {
              color: 'rgba(51, 65, 85, 0.4)',
            },
            ticks: {
              color: '#94a3b8',
              font: { size: 11 },
              maxRotation: 45,
            },
          },
          y: {
            beginAtZero: true,
            max: this.type === 'cpu' || this.type === 'ram' ? 100 : undefined,
            grid: {
              color: 'rgba(51, 65, 85, 0.4)',
            },
            ticks: {
              color: '#94a3b8',
              font: { size: 11 },
              callback: (value) => (this.type === 'network' ? `${value} M` : `${value}%`),
            },
          },
        },
      },
    });
  }
}
