import { Component, inject, model, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import {
  LucideCalculator,
  LucideChevronDown,
  LucideGitBranch,
  LucideLayoutDashboard,
  LucideLogOut,
  LucideNetwork,
  LucideRouter,
  LucideSettings,
  LucideUsers,
  LucideX,
  LucideMessageCircle,
  LucideDollarSign,
  LucideMapPin,
  LucideEye,
  LucideEyeOff,
} from '@lucide/angular';
import { AuthService } from '../../../core/services/auth.service';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { ToastComponent } from '../../../shared/components/toast/toast.component';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    RouterLinkActive,
    LucideCalculator,
    LucideChevronDown,
    LucideGitBranch,
    LucideLayoutDashboard,
    LucideLogOut,
    LucideNetwork,
    LucideRouter,
    LucideSettings,
    LucideUsers,
    LucideX,
    LucideMessageCircle,
    LucideDollarSign,
    LucideMapPin,
    LucideEye,
    LucideEyeOff,
    ModalComponent,
    ToastComponent,
  ],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css',
})
export class SidebarComponent implements OnInit {
  readonly auth = inject(AuthService);
  private router = inject(Router);

  // Sidebar state
  mobile = model(false);
  coreOpen = signal(false);
  routerOpen = signal(false);
  pppoeOpen = signal(false);
  toolOpen = signal(false);
  monitoringOpen = signal(false);
  botWaOpen = signal(false);
  financeOpen = signal(false);
  profileOpen = signal(false);
  savingProfile = signal(false);
  changePassword = signal(false);
  showNewPassword = signal(false);
  showConfirmPassword = signal(false);
  toast = signal<{ message: string; type: 'success' | 'error' } | null>(null);
  profileForm = { name: '', phone: '', photo: '', password: '', passwordConfirm: '' };

  // Navigation links
  readonly coreLinks = [
    ['Telusuri Jalur', '/dashboard/mainCore/traceJalur'],
    ['Server', '/dashboard/mainCore/server'],
    ['Rasio', '/dashboard/mainCore/rasio'],
    ['ODC', '/dashboard/mainCore/odc'],
    ['ODP', '/dashboard/mainCore/odp'],
  ];
  readonly routerLinks = [
    ['Router / NAS', '/dashboard/router/routers'],
    ['Server VPN', '/dashboard/router/vpn-server'],
    ['Klien VPN', '/dashboard/router/vpn-client'],
  ];
  readonly pppoeLinks = [
    ['Data Pelanggan', '/dashboard/pppoe/data-pelanggan'],
    ['Paket Layanan', '/dashboard/pppoe/paket-layanan'],
    ['IP Pool', '/dashboard/pppoe/ip-pools'],
  ];
  readonly botWaLinks = [
    ['Login Bot Wa', '/dashboard/bot-whatsapp/status'],
    ['Template Pesan', '/dashboard/bot-whatsapp/template'],
    ['Log Notifikasi', '/dashboard/bot-whatsapp/logs']
  ];
  readonly financeLinks = [
    ['Ringkasan', '/dashboard/finance/ringkasan'],
    ['Transaksi', '/dashboard/finance/transaksi'],
    ['Setoran Kolektor', '/dashboard/finance/setoran'],
  ];

  ngOnInit(): void {
    const url = this.router.url;
    if (url.includes('/mainCore')) this.coreOpen.set(true);
    if (url.includes('/router')) this.routerOpen.set(true);
    if (url.includes('/pppoe')) this.pppoeOpen.set(true);
    if (url.includes('/monitoring')) this.monitoringOpen.set(true);
    if (url.includes('/tools')) this.toolOpen.set(true);
    if (url.includes('/bot-whatsapp')) this.botWaOpen.set(true);
    if (url.includes('/finance')) this.financeOpen.set(true);
  }

  openProfile(): void {
    const user = this.auth.user();
    if (!user) return;
    this.profileForm = {
      name: user.name,
      phone: user.phone ?? '',
      photo: user.photo ?? '',
      password: '',
      passwordConfirm: '',
    };
    this.changePassword.set(false);
    this.profileOpen.set(true);
  }

  chooseProfilePhoto(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.match(/^image\/(jpeg|png|webp)$/)) {
      this.toast.set({ message: 'Foto wajib JPG, PNG, atau WebP.', type: 'error' });
      input.value = '';
      return;
    }
    if (file.size > 2_000_000) {
      this.toast.set({ message: 'Foto maksimal 2 MB.', type: 'error' });
      input.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      this.profileForm = { ...this.profileForm, photo: String(reader.result || '') };
    };
    reader.readAsDataURL(file);
  }

  clearProfilePhoto(): void {
    this.profileForm = { ...this.profileForm, photo: '' };
  }

  openPasswordForm(): void {
    this.profileForm = { ...this.profileForm, password: '', passwordConfirm: '' };
    this.showNewPassword.set(false);
    this.showConfirmPassword.set(false);
    this.changePassword.set(true);
  }

  closePasswordForm(): void {
    this.profileForm = { ...this.profileForm, password: '', passwordConfirm: '' };
    this.showNewPassword.set(false);
    this.showConfirmPassword.set(false);
    this.changePassword.set(false);
  }

  async saveProfile(): Promise<void> {
    if (this.savingProfile()) return;
    if (!this.profileForm.name.trim()) {
      this.toast.set({ message: 'Nama wajib diisi.', type: 'error' });
      return;
    }
    this.savingProfile.set(true);
    try {
      const message = await this.auth.updateProfile({
        name: this.profileForm.name.trim(),
        phone: this.profileForm.phone.trim(),
        photo: this.profileForm.photo,
      });
      this.profileOpen.set(false);
      this.toast.set({ message, type: 'success' });
    } catch (error: any) {
      this.toast.set({ message: error.message || 'Pengaturan akun gagal disimpan.', type: 'error' });
    } finally {
      this.savingProfile.set(false);
    }
  }

  async savePassword(): Promise<void> {
    if (this.savingProfile()) return;
    if (this.profileForm.password.length < 6) {
      this.toast.set({ message: 'Password baru minimal 6 karakter.', type: 'error' });
      return;
    }
    if (this.profileForm.password !== this.profileForm.passwordConfirm) {
      this.toast.set({ message: 'Konfirmasi password tidak sama.', type: 'error' });
      return;
    }
    this.savingProfile.set(true);
    try {
      const message = await this.auth.updateProfile({
        name: this.profileForm.name.trim(),
        phone: this.profileForm.phone.trim(),
        photo: this.profileForm.photo,
        password: this.profileForm.password,
      });
      this.profileForm = { ...this.profileForm, password: '', passwordConfirm: '' };
      this.showNewPassword.set(false);
      this.showConfirmPassword.set(false);
      this.changePassword.set(false);
      this.toast.set({ message, type: 'success' });
    } catch (error: any) {
      this.toast.set({ message: error.message || 'Password gagal disimpan.', type: 'error' });
    } finally {
      this.savingProfile.set(false);
    }
  }

  roleLabel(role?: string): string {
    switch (role) {
      case 'admin':
        return 'Admin';
      case 'teknisi':
        return 'Teknisi';
      case 'finance':
        return 'Keuangan';
      case 'sales':
        return 'Sales';
      case 'kolektor':
        return 'Kolektor';
      default:
        return role || '';
    }
  }
}
