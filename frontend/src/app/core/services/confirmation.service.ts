import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

export interface Confirmation {
  title: string;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class ConfirmationService {
  private readonly document = inject(DOCUMENT);
  private readonly pending = signal<Confirmation | null>(null);
  readonly current = this.pending.asReadonly();
  private resolve: ((accepted: boolean) => void) | null = null;
  private opener: HTMLElement | null = null;

  constructor() {
    inject(Router, { optional: true })?.events.pipe(takeUntilDestroyed()).subscribe(event => {
      if (event instanceof NavigationStart) this.answer(false);
    });
  }

  ask(title: string, message: string): Promise<boolean> {
    // Ignore repeated clicks while a decision is pending.
    if (this.pending()) return Promise.resolve(false);
    this.opener = this.document.activeElement as HTMLElement | null;
    return new Promise(resolve => {
      this.resolve = resolve;
      this.pending.set({ title, message });
    });
  }

  answer(accepted: boolean): void {
    const resolve = this.resolve;
    this.resolve = null;
    this.pending.set(null);
    if (this.opener?.isConnected) this.opener.focus();
    this.opener = null;
    resolve?.(accepted);
  }
}
