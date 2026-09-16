import { Component, EventEmitter, Input, Output } from '@angular/core';
import { LucideX } from '@lucide/angular';

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [LucideX],
  templateUrl: './modal.component.html',
  styles: [`
    .compact-modal { max-height: calc(100dvh - 16px); }
    .compact-modal .modal-header { padding: clamp(8px, 1.5dvh, 14px) 16px; }
    .compact-modal .modal-body { padding: clamp(8px, 1.5dvh, 14px) 16px; }
    @media (max-width: 480px) {
      .compact-modal .modal-header, .compact-modal .modal-body { padding-left: 12px; padding-right: 12px; }
    }
  `],
})
export class ModalComponent {
  @Input() open = false;
  @Input() title = '';
  @Input() wide = false;
  @Input() compact = false;
  @Input() maxWidth: string | null = null;
  @Output() closeModal = new EventEmitter<void>();
}
