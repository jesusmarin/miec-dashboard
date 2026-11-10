import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { CycleView, SystemView, SystemsApi } from '../../core/api/systems-api.service';

/** Consulta y creación controlada de ciclos de un sistema. No inicia ni modifica ciclos. */
@Component({
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <main>
      <nav aria-label="Navegación de sistemas"><a routerLink="/systems">Volver a sistemas</a></nav>
      <h1>Ciclos del sistema</h1>

      @if (loadingSystem()) { <p role="status">Consultando sistema…</p> }
      @if (system()) {
        <h2>{{ system()!.name }}</h2>
        <p>Estado administrativo: {{ system()!.status }}</p>
      }
      @if (systemError()) { <p role="alert">{{ systemError() }}</p> }

      @if (system()) {
        @if (auth.session()?.role === 'AUTHOR') {
          <section aria-labelledby="create-cycle-title">
            <h3 id="create-cycle-title">Nuevo ciclo</h3>
            <p>El nuevo ciclo quedará inactivo con autonomía A0. No se iniciará automáticamente.</p>
            <form (ngSubmit)="createCycle()">
              <label for="configuration-version-id">Versión de configuración (opcional)</label>
              <input id="configuration-version-id" [formControl]="configurationVersionId" maxlength="100"/>
              @if (configurationVersionId.invalid && configurationVersionId.touched) {
                <p role="alert">La versión de configuración admite hasta 100 caracteres.</p>
              }
              <button type="submit" [disabled]="creating() || configurationVersionId.invalid">
                {{ creating() ? 'Creando ciclo…' : 'Crear ciclo inactivo' }}
              </button>
            </form>
          </section>
        }

        @if (success()) { <p role="status">{{ success() }}</p> }
        @if (createError()) { <p role="alert">{{ createError() }}</p> }
        <section aria-labelledby="cycles-title">
          <h3 id="cycles-title">Ciclos registrados</h3>
          <button type="button" (click)="loadCycles(false)" [disabled]="loadingCycles()">Actualizar ciclos</button>
          @if (loadingCycles()) { <p role="status">Consultando ciclos…</p> }
          @if (cyclesError()) { <p role="alert">{{ cyclesError() }}</p> }
          <ul>
            @for (cycle of cycles(); track cycle.cycleId) {
              <li>
                <strong>Ciclo #{{ cycle.cycleNumber }}</strong>
                — {{ cycle.state }} · {{ cycle.autonomyLevel }}
                · versión {{ cycle.version }}
                <p>Creado: {{ cycle.createdAt }}</p>
                <p>Inicio: {{ cycle.startedAt ?? 'Sin iniciar' }}</p>
                @if (cycle.configurationVersionId) {
                  <p>Configuración: {{ cycle.configurationVersionId }}</p>
                }
              </li>
            } @empty {
              @if (!loadingCycles() && !cyclesError()) {
                <li>Este sistema todavía no tiene ciclos registrados.</li>
              }
            }
          </ul>
          @if (cursor()) {
            <button type="button" (click)="loadCycles(true)" [disabled]="loadingCycles()">Ver más ciclos</button>
          }
        </section>
      }
    </main>
  `
})
export class SystemCyclesComponent {
  readonly auth = inject(AuthService);
  private readonly api = inject(SystemsApi);
  private readonly route = inject(ActivatedRoute);
  readonly systemId = this.route.snapshot.paramMap.get('systemId') ?? '';

  readonly system = signal<SystemView | null>(null);
  readonly cycles = signal<CycleView[]>([]);
  readonly cursor = signal<string | null>(null);
  readonly loadingSystem = signal(true);
  readonly loadingCycles = signal(false);
  readonly creating = signal(false);
  readonly systemError = signal('');
  readonly cyclesError = signal('');
  readonly createError = signal('');
  readonly success = signal('');
  readonly configurationVersionId = new FormControl('', {
    nonNullable: true, validators: [Validators.maxLength(100)]
  });

  constructor() { void this.init(); }

  private async init(): Promise<void> {
    try {
      this.system.set(await this.api.get(this.systemId));
      await this.loadCycles(false);
    } catch (error: unknown) {
      this.systemError.set(error instanceof HttpErrorResponse && error.status === 404
        ? 'No existe el sistema solicitado.'
        : 'No se pudo consultar el sistema. Comprueba la sesión y el motor.');
    } finally {
      this.loadingSystem.set(false);
    }
  }

  async loadCycles(next: boolean): Promise<void> {
    if (this.loadingCycles()) return;
    this.loadingCycles.set(true);
    this.cyclesError.set('');
    try {
      const page = await this.api.listCycles(this.systemId, next ? this.cursor() ?? undefined : undefined);
      this.cycles.update(old => next ? [...old, ...page.items] : page.items);
      this.cursor.set(page.nextCursor);
    } catch (error: unknown) {
      this.cyclesError.set(error instanceof HttpErrorResponse && error.status === 404
        ? 'No existe el sistema solicitado.'
        : 'No se pudieron consultar los ciclos. Comprueba la conexión.');
    } finally {
      this.loadingCycles.set(false);
    }
  }

  async createCycle(): Promise<void> {
    if (this.creating()) return;
    if (this.auth.session()?.role !== 'AUTHOR') {
      this.createError.set('Tu cuenta no tiene permiso para crear ciclos.');
      return;
    }
    if (this.configurationVersionId.invalid) {
      this.configurationVersionId.markAsTouched();
      return;
    }
    this.creating.set(true);
    this.createError.set('');
    this.success.set('');
    try {
      const raw = this.configurationVersionId.value.trim();
      const created = await this.api.createCycle(this.systemId, {
        configurationVersionId: raw || null
      });
      this.success.set('Ciclo #' + created.cycleNumber + ' creado, pendiente de inicio.');
      this.configurationVersionId.reset();
      await this.loadCycles(false);
    } catch (error: unknown) {
      if (error instanceof HttpErrorResponse && error.status === 403) {
        this.createError.set('No tienes permiso para crear ciclos.');
      } else if (error instanceof HttpErrorResponse && error.status === 400) {
        this.createError.set('Versión de configuración inválida.');
      } else if (error instanceof HttpErrorResponse && error.status === 404) {
        this.createError.set('El sistema ya no existe.');
      } else {
        this.createError.set('No se pudo crear el ciclo. Revisa la conexión.');
      }
    } finally {
      this.creating.set(false);
    }
  }
}
