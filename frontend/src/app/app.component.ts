import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { ConfirmationComponent } from './shared/components/confirmation/confirmation.component';
import { ConfirmationService } from './core/services/confirmation.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ConfirmationComponent],
  templateUrl: './app.component.html',
})
export class AppComponent implements OnInit {
  private auth = inject(AuthService);
  readonly confirmation = inject(ConfirmationService);

  ngOnInit(): void {
    this.auth.loadUser();
  }
}
