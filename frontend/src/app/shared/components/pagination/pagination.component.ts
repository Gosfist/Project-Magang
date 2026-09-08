import { Component, EventEmitter, Input, Output } from '@angular/core';
import { PageMeta } from '../../models/types';

@Component({
  selector: 'app-pagination',
  standalone: true,
  templateUrl: './pagination.component.html',
})
export class PaginationComponent {
  @Input() meta!: PageMeta;
  @Output() pageChange = new EventEmitter<number>();

  get pages(): number[] {
    if (!this.meta) return [];
    return Array.from({ length: this.meta.lastPage }, (_, i) => i + 1)
      .filter(page =>
        page === 1 ||
        page === this.meta.lastPage ||
        Math.abs(page - this.meta.currentPage) <= 1
      );
  }
}
