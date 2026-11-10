import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { SystemsApi, SystemSummary, SystemView } from '../../core/api/systems-api.service';
import { CreateSystemComponent } from './create-system.component';

/** Catálogo de sistemas y primer comando de alta autorizado del dashboard. */
@Component({
  standalone: true,
  imports: [ReactiveFormsModule, CreateSystemComponent],
  template: `
    <main>
      <header>
        <h1>Sistemas MIEC</h1>
        <p>Sesión: {{ auth.session()?.username }} ({{ auth.session()?.role }})</p>
        <button type="button" (click)="exit()">Salir</button>
      </header>

      <section aria-label="Buscar sistemas">
        <label for="system-search">Buscar sistema</label>
        <input id="system-search" [formControl]="q" (keyup.enter)="load(false)"/>
        <button type="button" (click)="load(false)" [disabled]="loading()">Buscar</button>
        @if (auth.session()?.role === 'AUTHOR' && !creating()) {
          <button type="button" (click)="creating.set(true)">Nuevo sistema</button>
        }
      </section>

      @if (auth.session()?.role === 'AUTHOR' && creating()) {
        <miec-create-system (created)="onCreated($event)" (cancelled)="creating.set(false)" />
      }

      @if (success()) { <p role="status">{{ success() }}</p> }
      @if (error()) { <p role="alert">{{ error() }}</p> }
      @if (loading()) { <p role="status">Consultando...</p> }

      <ul>
        @for (s of systems(); track s.systemId) {
          <li>
            <strong>{{ s.name }}</strong> — {{ s.status }} · {{ s.cycleCount }} ciclos
            <small>Reciente: {{ s.recentCycle?.state ?? 'Sin ciclos' }}</small>
          </li>
        } @empty {
          <li>No se encontraron sistemas</li>
        }
      </ul>
      @if (cursor()) {
        <button type="button" (click)="load(true)" [disabled]="loading()">Ver más</button>
      }
    </main>
  `
})
export class SystemsComponent {
  readonly auth = inject(AuthService);
  private readonly api = inject(SystemsApi);
  private readonly router = inject(Router);

  readonly q = new FormControl('', { nonNullable: true });
  readonly systems = signal<SystemSummary[]>([]);
  readonly cursor = signal<string | null>(null);
  readonly loading = signal(false);
  readonly creating = signal(false);
  readonly error = signal('');
  readonly success = signal('');

  constructor() { void this.load(false); }

  async load(next: boolean): Promise<void> {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    try {
      const page = await this.api.list(this.q.value, next ? this.cursor() ?? undefined : undefined);
      this.systems.update(old => next ? [...old, ...page.items] : page.items);
      this.cursor.set(page.nextCursor);
    } catch {
      this.error.set('No se pudo consultar los sistemas. Comprueba la sesión y el motor.');
    } finally {
      this.loading.set(false);
    }
  }

  /** Un alta confirmada reinicia la búsqueda, para hacer visible el nuevo sistema. */
  async onCreated(created: SystemView): Promise<void> {
    this.creating.set(false);
    this.q.setValue('');
    this.success.set('Sistema «' + created.name + '» registrado correctamente.');
    await this.load(false);
  }

  async exit(): Promise<void> {
    try { await this.auth.logout(); }
    finally { await this.router.navigateByUrl('/login'); }
  }
}
