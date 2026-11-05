import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
export const routes: Routes = [
 {path:'login', loadComponent:()=>import('./features/login/login.component').then(x=>x.LoginComponent)},
 {path:'systems', canActivate:[authGuard],loadComponent:()=>import('./features/systems/systems.component').then(x=>x.SystemsComponent)},
 {path:'',pathMatch:'full',redirectTo:'systems'},
 {path:'**',redirectTo:'systems'}
];
