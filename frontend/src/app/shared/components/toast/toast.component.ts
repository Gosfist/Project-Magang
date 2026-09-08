import { Component, EventEmitter, Input, Output } from '@angular/core';
import { LucideX } from '@lucide/angular';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [LucideX],
  templateUrl: './toast.component.html',
})
export class ToastComponent {
  @Input() message = '';
  @Input() type: 'success' | 'error' = 'success';
  @Output() close = new EventEmitter<void>();
}
