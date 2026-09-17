import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideCheck } from '@lucide/angular';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink, LucideCheck],
  templateUrl: './landing.component.html',
})
export class LandingComponent {
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
  readonly packages = [
    {
      name: 'Fiber Pemula',
      price: '50.000',
      desc: 'Untuk menjelajah internet, belajar, dan penggunaan harian.',
      popular: false,
      details: [
        ['Kecepatan', '10 Mbps'],
        ['Batas data', 'Tanpa batas'],
        ['Dukungan', 'Teknis responsif'],
      ],
    },
    {
      name: 'Fiber Keluarga',
      price: '100.000',
      desc: 'Nyaman untuk menonton video, bekerja, dan banyak perangkat.',
      popular: true,
      details: [
        ['Kecepatan', '20 Mbps'],
        ['Batas data', 'Tanpa batas'],
        ['Dukungan', 'Teknis responsif'],
      ],
    },
    {
      name: 'Fiber Usaha',
      price: '150.000',
      desc: 'Koneksi andal untuk usaha dan kebutuhan lebih intensif.',
      popular: false,
      details: [
        ['Kecepatan', '30 Mbps'],
        ['Batas data', 'Tanpa batas'],
        ['Dukungan', 'Teknis responsif'],
      ],
    },
  ];
}
