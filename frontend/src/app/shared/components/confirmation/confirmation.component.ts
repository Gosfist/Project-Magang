import { afterRenderEffect, Component, ElementRef, inject, viewChild } from '@angular/core';
import { ConfirmationService } from '../../../core/services/confirmation.service';
import { ModalComponent } from '../modal/modal.component';

@Component({
  selector: 'app-confirmation',
  standalone: true,
  imports: [ModalComponent],
  host: { '(document:keydown)': 'onKeydown($event)' },
  template: `
    @if (confirmation.current(); as dialog) {
      <app-modal [open]="true" [title]="dialog.title" (closeModal)="confirmation.answer(false)">
        <p class="whitespace-pre-line break-words">{{ dialog.message }}</p>
        <div class="mt-4 flex justify-end gap-2">
          <button #cancel type="button" class="btn-secondary" (click)="confirmation.answer(false)">Batal</button>
          <button type="button" class="btn-danger" (click)="confirmation.answer(true)">Hapus</button>
        </div>
      </app-modal>
    }
  `,
})
export class ConfirmationComponent {
  readonly confirmation = inject(ConfirmationService);
  private readonly element: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly cancel = viewChild<ElementRef<HTMLButtonElement>>('cancel');

  constructor() {
    afterRenderEffect(() => this.cancel()?.nativeElement.focus());
  }

  onKeydown(event: KeyboardEvent): void {
    if (!this.confirmation.current()) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.confirmation.answer(false);
    } else if (event.key === 'Tab') {
      const buttons = this.element.nativeElement.querySelectorAll<HTMLButtonElement>('button:not([disabled])');
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      const active = this.element.nativeElement.ownerDocument.activeElement;
      if (event.shiftKey && (active === first || !this.element.nativeElement.contains(active))) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && (active === last || !this.element.nativeElement.contains(active))) {
        event.preventDefault();
        first?.focus();
      }
    }
  }
}
