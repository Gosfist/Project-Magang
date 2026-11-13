import { afterRenderEffect, ElementRef, HostListener } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  Subject,
  debounceTime,
  distinctUntilChanged,
  switchMap,
  catchError,
  of,
} from 'rxjs';
import { LucidePlus, LucideSearch } from '@lucide/angular';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { ToastComponent } from '../../../shared/components/toast/toast.component';
import { PageMeta } from '../../../shared/models/types';
interface Customer {
  id: string;
  customerName: string;
  customerNumber: string;
  address: string | null;
}
interface Termination {
  id: string;
  reason: string;
  requestedByName: string;
  requestedAt: string;
  collectedByName: string | null;
  completedAt: string | null;
  collectedAmount: string;
  waSentAt: string | null;
  account: Customer & { phone: string | null; package: { name: string } };
}
interface Summary {
  total: number;
  customerName: string;
  invoices: {
    invoiceNumber: string;
    amount: number;
    from?: string;
    through?: string;
  }[];
}
@Component({
  selector: 'app-termination',
  standalone: true,
  host: { class: 'workspace-page' },
  imports: [
    FormsModule,
    CurrencyPipe,
    DatePipe,
    LucidePlus,
    LucideSearch,
    ModalComponent,
    PaginationComponent,
    ToastComponent,
  ],
  templateUrl: './termination.component.html',
})
export class TerminationComponent implements OnInit {
  readonly auth = inject(AuthService);
  private element = inject<ElementRef<HTMLElement>>(ElementRef);
  private activeDialog: HTMLElement | null = null;
  private returnFocus: HTMLElement | null = null;
  constructor() {
    afterRenderEffect(() => {
      this.adding();
      this.selected();
      const dialog =
        this.element.nativeElement.querySelector<HTMLElement>(
          '[role="dialog"]',
        );
      if (dialog && dialog !== this.activeDialog) {
        this.activeDialog = dialog;
        dialog
          .querySelector<HTMLElement>('input, button, select, textarea')
          ?.focus();
      } else if (!dialog && this.activeDialog) {
        this.activeDialog = null;
        this.returnFocus?.focus();
      }
    });
  }
  @HostListener('document:keydown', ['$event'])
  dialogKeys(event: KeyboardEvent) {
    const dialog =
      this.element.nativeElement.querySelector<HTMLElement>('[role="dialog"]');
    if (!dialog) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      if (!this.saving()) {
        this.adding.set(false);
        this.closeCompletion();
      }
    }
    if (event.key !== 'Tab') return;
    const controls = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
      ),
    ).filter((el) => el.getClientRects().length);
    const first = controls[0],
      last = controls.at(-1);
    if (
      event.shiftKey &&
      (document.activeElement === first ||
        !dialog.contains(document.activeElement))
    ) {
      event.preventDefault();
      last?.focus();
    } else if (
      !event.shiftKey &&
      (document.activeElement === last ||
        !dialog.contains(document.activeElement))
    ) {
      event.preventDefault();
      first?.focus();
    }
  }
  private api = inject(ApiService);
  private destroyRef = inject(DestroyRef);
  private lookup = new Subject<string>();
  private searches = new Subject<void>();
  private listVersion = 0;
  private summaryVersion = 0;
  items = signal<Termination[]>([]);
  options = signal<Customer[]>([]);
  meta = signal<PageMeta>({
    currentPage: 1,
    lastPage: 1,
    perPage: 10,
    total: 0,
  });
  page = 1;
  search = '';
  status = 'PENDING';
  loading = signal(false);
  saving = signal(false);
  adding = signal(false);
  selected = signal<Termination | null>(null);
  summary = signal<Summary | null>(null);
  summaryLoading = signal(false);
  error = signal('');
  toast = signal<{ message: string; type: 'success' | 'error' } | null>(null);
  customerSearch = '';
  accountId = '';
  reason = '';
  confirmed = false;
  ngOnInit() {
    this.lookup
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((search) =>
          this.api
            .get<{ data: Customer[] }>(
              `/pppoe/terminations/options?search=${encodeURIComponent(search)}`,
            )
            .pipe(
              catchError((e) => {
                this.error.set(e.message);
                return of({ data: [] });
              }),
            ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((r) => this.options.set(r.data));
    this.searches
      .pipe(debounceTime(250), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.load());
    this.load();
  }
  searchChanged() {
    this.page = 1;
    this.searches.next();
  }
  lookupChanged() {
    this.accountId = '';
    this.options.set([]);
    this.lookup.next(this.customerSearch);
  }
  load() {
    const version = ++this.listVersion;
    this.loading.set(true);
    this.api
      .get<{ data: Termination[]; meta: PageMeta }>(
        `/pppoe/terminations?search=${encodeURIComponent(this.search)}&status=${this.status}&page=${this.page}`,
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) => {
          if (version !== this.listVersion) return;
          this.items.set(r.data);
          this.meta.set(r.meta);
          this.loading.set(false);
        },
        error: (e) => {
          if (version !== this.listVersion) return;
          this.loading.set(false);
          this.toast.set({ message: e.message, type: 'error' });
        },
      });
  }
  add() {
    this.returnFocus = document.activeElement as HTMLElement;
    this.error.set('');
    this.customerSearch = '';
    this.accountId = '';
    this.reason = '';
    this.options.set([]);
    this.adding.set(true);
  }
  create() {
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    this.api
      .post<{ message: string; warnings?: string[] }>('/pppoe/terminations', {
        accountId: this.accountId,
        reason: this.reason,
      })
      .subscribe({
        next: (r) => {
          this.saving.set(false);
          this.adding.set(false);
          this.status = 'PENDING';
          this.page = 1;
          this.toast.set({ message: r.message, type: r.warnings?.length ? 'error' : 'success' });
          this.load();
        },
        error: (e) => {
          this.saving.set(false);
          this.error.set(e.message);
        },
      });
  }
  openCompletion(item: Termination) {
    this.returnFocus = document.activeElement as HTMLElement;
    this.selected.set(item);
    this.summary.set(null);
    this.confirmed = false;
    this.error.set('');
    this.summaryLoading.set(true);
    const version = ++this.summaryVersion;
    this.api.get<Summary>(`/pppoe/terminations/${item.id}/summary`).subscribe({
      next: (r) => {
        if (version !== this.summaryVersion) return;
        this.summary.set(r);
        this.summaryLoading.set(false);
      },
      error: (e) => {
        if (version !== this.summaryVersion) return;
        this.error.set(e.message);
        this.summaryLoading.set(false);
      },
    });
  }
  closeCompletion() {
    if (this.saving()) return;
    ++this.summaryVersion;
    this.selected.set(null);
  }
  complete() {
    const item = this.selected(),
      summary = this.summary();
    if (!item || !summary || !this.confirmed || this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    this.api
      .post<{ message: string; warnings: string[] }>(
        `/pppoe/terminations/${item.id}/complete`,
        { amount: summary.total },
      )
      .subscribe({
        next: (r) => {
          this.saving.set(false);
          this.selected.set(null);
          this.toast.set({
            message: r.message,
            type: r.warnings.length ? 'error' : 'success',
          });
          this.load();
        },
        error: (e) => {
          this.saving.set(false);
          this.error.set(e.message);
          this.summary.set(null);
          this.confirmed = false;
        },
      });
  }
  resend(item: Termination) {
    if (this.saving()) return;
    this.saving.set(true);
    this.api
      .post<{ message: string }>(`/pppoe/terminations/${item.id}/notify`, {})
      .subscribe({
        next: (r) => {
          this.saving.set(false);
          this.toast.set({ message: r.message, type: 'success' });
          this.load();
        },
        error: (e) => {
          this.saving.set(false);
          this.toast.set({ message: e.message, type: 'error' });
        },
      });
  }
}
