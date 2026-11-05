import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { SystemsApi, SystemSummary } from '../../core/api/systems-api.service';
@Component({standalone:true,imports:[ReactiveFormsModule],template:`
<main><header><h1>Sistemas MIEC</h1><p>Sesión: {{auth.session()?.username}} ({{auth.session()?.role}})</p>
<button (click)="exit()">Salir</button></header>
<section><label>Buscar sistema <input [formControl]="q" (keyup.enter)="load(false)"></label><button (click)="load(false)">Buscar</button></section>
@if(error()){<p role="alert">{{error()}}</p>}
@if(loading()){<p>Consultando...</p>}
<ul>@for(s of systems();track s.systemId){<li><strong>{{s.name}}</strong> — {{s.status}} · {{s.cycleCount}} ciclos
 <small>Reciente: {{s.recentCycle?.state??'Sin ciclos'}}</small></li>}@empty{<li>No se encontraron sistemas</li>}</ul>
@if(cursor()){<button (click)="load(true)">Ver más</button>}
</main>`})
export class SystemsComponent {
 readonly auth=inject(AuthService);private readonly api=inject(SystemsApi);private readonly router=inject(Router);
 readonly q=new FormControl('',{nonNullable:true});readonly systems=signal<SystemSummary[]>([]);
 readonly cursor=signal<string|null>(null);readonly loading=signal(false);readonly error=signal('');
 constructor(){void this.load(false)}
 async load(next:boolean){if(this.loading())return;this.loading.set(true);this.error.set('');
 try {const page=await this.api.list(this.q.value,next?this.cursor()??undefined:undefined);
 this.systems.update(old=>next?[...old,...page.items]:page.items);this.cursor.set(page.nextCursor);}
 catch{this.error.set('No se pudo consultar los sistemas. Compruebe la sesión y el motor.');}finally{this.loading.set(false);}}
 async exit(){try {await this.auth.logout()}finally{await this.router.navigateByUrl('/login')}}
}
