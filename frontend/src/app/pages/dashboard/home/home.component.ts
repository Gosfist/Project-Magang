import { Component, inject, OnInit, signal } from '@angular/core';
import { LucideGitBranch, LucideNetwork, LucideServer, LucideUsers } from '@lucide/angular';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';

type StatCard = {
  label: string;
  value: number | undefined;
  type: 'server' | 'odc' | 'odp' | 'redaman' | 'users';
};

@Component({
  selector: 'app-dashboard-home',
  standalone: true,
  imports: [LucideGitBranch, LucideNetwork, LucideServer, LucideUsers],
  templateUrl: './home.component.html',
})
export class HomeComponent implements OnInit {
  readonly auth = inject(AuthService);
  private api = inject(ApiService);

  private stats = signal<Record<string, number>>({});
  cards = signal<StatCard[]>([]);

  ngOnInit(): void {
    this.api.get<Record<string, number>>('/dashboard/stats').subscribe({
      next: (data) => {
        this.stats.set(data);
        this.buildCards();
      },
      error: () => {},
    });
  }

  private buildCards(): void {
    const s = this.stats();
    const result: StatCard[] = [
      { label: 'Server Inti', value: s['totalServerCores'], type: 'server' },
      { label: 'Total ODC', value: s['totalOdcs'], type: 'odc' },
      { label: 'Total ODP', value: s['totalOdps'], type: 'odp' },
      { label: 'Data Redaman', value: s['totalWithRedaman'], type: 'redaman' },
    ];
    if (this.auth.isAdmin()) {
      result.push({ label: 'Total Petugas', value: s['totalPetugas'], type: 'users' });
      result.push({ label: 'Total Pengguna', value: s['totalUsers'], type: 'users' });
    }
    this.cards.set(result);
  }
}
