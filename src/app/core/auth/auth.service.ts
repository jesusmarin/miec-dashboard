import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
export type Role = 'AUTHOR' | 'APPROVER';
export interface SessionInfo { username: string; role: Role; expiresAt: string; }
@Injectable({providedIn:'root'})
export class AuthService {
  private readonly http=inject(HttpClient);
  readonly session=signal<SessionInfo|null>(null);
  async restore():Promise<boolean>{
    try { this.session.set(await firstValueFrom(this.http.get<SessionInfo>('/bff/session')));return true; }
    catch {this.session.set(null);return false;}
  }
  async login(username:string,password:string):Promise<void>{
    const user=await firstValueFrom(this.http.post<SessionInfo>('/bff/login',{username,password}));
    this.session.set(user);
  }
  async logout():Promise<void>{try {await firstValueFrom(this.http.post('/bff/logout',{}));}finally{this.session.set(null);}}
}
