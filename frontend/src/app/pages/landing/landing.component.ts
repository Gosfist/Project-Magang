import { Component, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiService } from '../../core/services/api.service';
import { PublicPackage } from '../../shared/models/types';
import { LucideCheck } from '@lucide/angular';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [LucideCheck],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.css',
})
export class LandingComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly untilDestroyed = takeUntilDestroyed<{ data: PublicPackage[] }>();
  readonly packages = signal<PublicPackage[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly mobileMenuOpen = signal(false);
  readonly currentYear = new Date().getFullYear();
  readonly navLinks = [
    ['Beranda', 'beranda'],
    ['Tentang Kami', 'tentang-kami'],
    ['Layanan', 'layanan'],
    ['Kontak', 'kontak'],
  ];
  readonly benefits = [
    ['Cepat', 'Lebar pita stabil untuk bekerja, belajar, menonton video, dan bermain gim.'],
    ['Aman', 'Jaringan terkelola dengan pemantauan dan perawatan rutin.'],
    ['Responsif', 'Tim teknis siap membantu saat Anda membutuhkan dukungan.'],
  ];
  ngOnInit(): void {
    this.loadPackages();
  }

  loadPackages(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.api.get<{ data: PublicPackage[] }>('/public/packages').pipe(this.untilDestroyed).subscribe({
      next: response => {
        this.packages.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set(true);
        this.loading.set(false);
      },
    });
  }

  formatPrice(price: number): string {
    return price.toLocaleString('id-ID');
  }
}
