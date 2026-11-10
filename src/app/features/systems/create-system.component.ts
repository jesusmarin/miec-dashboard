import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import {
  AbstractControl, FormControl, FormGroup, ReactiveFormsModule,
  ValidationErrors, Validators
} from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import { CreateSystemCommand, SystemsApi, SystemView } from '../../core/api/systems-api.service';

/** Evita enviar nombres que contienen exclusivamente espacios en blanco. */
function notBlank(control: AbstractControl): ValidationErrors | null {
  return typeof control.value === 'string' && control.value.trim().length > 0
    ? null : { blank: true };
}

function optional(value: string): string | null {
  return value.trim() || null;
}

@Component({
  selector: 'miec-create-system',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <section class="create-system" aria-labelledby="create-system-title">
      <h2 id="create-system-title">Registrar sistema MIEC</h2>
      <p>El motor MIEC asigna el identificador y el estado inicial.</p>

      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <label for="system-name">Nombre del sistema (obligatorio)</label>
        <input id="system-name" formControlName="name" maxlength="255"
               autocomplete="off" [attr.aria-invalid]="form.controls.name.invalid && form.controls.name.touched"/>
        @if (form.controls.name.touched && form.controls.name.invalid) {
          <p role="alert">Indica un nombre válido de máximo 255 caracteres.</p>
        }

        <label for="system-domain">Dominio (opcional)</label>
        <input id="system-domain" formControlName="domain" maxlength="100"
               placeholder="software"/>

        <label for="system-description">Descripción (opcional)</label>
        <textarea id="system-description" formControlName="description"
                  maxlength="4000" rows="3"></textarea>

        <label for="system-owner">Referencia del responsable (opcional)</label>
        <input id="system-owner" formControlName="ownerReference" maxlength="255"/>

        @if (error()) { <p role="alert">{{ error() }}</p> }
        <div class="actions">
          <button type="submit" [disabled]="saving() || form.invalid">
            {{ saving() ? 'Registrando…' : 'Registrar sistema' }}
          </button>
          <button type="button" [disabled]="saving()" (click)="cancelled.emit()">Cancelar</button>
        </div>
      </form>
    </section>
  `
})
export class CreateSystemComponent {
  private readonly api = inject(SystemsApi);
  private readonly auth = inject(AuthService);
  @Output() readonly created = new EventEmitter<SystemView>();
  @Output() readonly cancelled = new EventEmitter<void>();

  readonly saving = signal(false);
  readonly error = signal('');
  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, notBlank, Validators.maxLength(255)] }),
    domain: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(100)] }),
    description: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(4000)] }),
    ownerReference: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(255)] })
  });

  async submit(): Promise<void> {
    if (this.saving()) return;
    if (this.auth.session()?.role !== 'AUTHOR') {
      this.error.set('Tu cuenta no puede registrar sistemas.');
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const command: CreateSystemCommand = {
      name: value.name.trim(),
      domain: optional(value.domain),
      description: optional(value.description),
      ownerReference: optional(value.ownerReference)
    };
    this.saving.set(true);
    this.error.set('');
    try {
      const result = await this.api.create(command);
      this.created.emit(result);
    } catch (error: unknown) {
      if (error instanceof HttpErrorResponse) {
        if (error.status === 401) this.error.set('La sesión expiró. Inicia sesión nuevamente.');
        else if (error.status === 403) this.error.set('No tienes permiso para registrar sistemas.');
        else if (error.status === 400) this.error.set('El motor rechazó los datos. Revisa los campos.');
        else if (error.status === 409) this.error.set('Conflicto al registrar. Actualiza el catálogo.');
        else this.error.set('No se pudo registrar el sistema. Comprueba la conexión.');
      } else this.error.set('No se pudo registrar el sistema.');
    } finally {
      this.saving.set(false);
    }
  }
}
