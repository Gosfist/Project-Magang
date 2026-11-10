import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { LucideEye, LucideEyeOff } from '@lucide/angular';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink, LucideEye, LucideEyeOff],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);

  email = '';
  password = '';
  error = signal('');
  busy = signal(false);
  showPassword = false;

  ngOnInit(): void {
    if (this.auth.user()) {
      this.router.navigate(['/dashboard']);
    }
  }

  async submit(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.auth.login(this.email.trim(), this.password);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Gagal masuk.');
    } finally {
      this.busy.set(false);
    }
  }
}
