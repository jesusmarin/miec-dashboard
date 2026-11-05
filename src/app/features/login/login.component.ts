import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
@Component({standalone:true,imports:[ReactiveFormsModule],template:`
<main class="auth"><h1>MIEC Dashboard</h1><p>Acceso local con sesión protegida</p>
<form [formGroup]="form" (ngSubmit)="submit()">
<label>Usuario<input autocomplete="username" formControlName="username"></label>
<label>Contraseña<input type="password" autocomplete="current-password" formControlName="password"></label>
<button type="submit" [disabled]="form.invalid||busy()">Ingresar</button>
@if(error()){<p role="alert">{{error()}}</p>}
</form></main>`})
export class LoginComponent {
 private readonly auth=inject(AuthService);private readonly router=inject(Router);
 readonly busy=signal(false); readonly error=signal('');
 readonly form=new FormGroup({username:new FormControl('',{nonNullable:true,validators:[Validators.required]}),password:new FormControl('',{nonNullable:true,validators:[Validators.required]})});
 async submit(){if(this.form.invalid||this.busy())return;this.busy.set(true);this.error.set('');
 try {const {username,password}=this.form.getRawValue();await this.auth.login(username,password);await this.router.navigateByUrl('/systems');}
 catch {this.error.set('No se pudo iniciar sesión');}finally{this.busy.set(false);}}
}
