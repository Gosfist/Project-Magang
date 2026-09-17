import { Component, EventEmitter, Input, OnInit, OnDestroy, Output } from '@angular/core';
import { LucideX } from '@lucide/angular';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [LucideX],
  templateUrl: './toast.component.html',
})
export class ToastComponent implements OnInit, OnDestroy {
  @Input() message = '';
  @Input() type: 'success' | 'error' = 'success';
  @Input() duration = 3000;
  @Output() close = new EventEmitter<void>();

  private timer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    if (this.duration > 0) {
      this.timer = setTimeout(() => {
        this.close.emit();
      }, this.duration);
    }
  }

  ngOnDestroy(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
