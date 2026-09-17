import { Component, inject, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './login.component.html',
})
export class LoginComponent implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);

  email = '';
  password = '';
  error = '';
  busy = false;

  ngOnInit(): void {
    if (this.auth.user()) {
      this.router.navigate(['/dashboard']);
    }
  }

  async submit(): Promise<void> {
    this.busy = true;
    this.error = '';
    try {
      await this.auth.login(this.email, this.password);
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Gagal masuk.';
    } finally {
      this.busy = false;
    }
  }
}
