import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
export interface SystemSummary {
 systemId:string;name:string;domain:string;status:string;createdAt:string;
 cycleCount:number;cyclesByState:Record<string,number>;lastActivityAt:string|null;
 recentCycle:{cycleId:string;cycleNumber:number;state:string;version:number;lastActivityAt:string|null}|null;
}
export interface SystemPage {items:SystemSummary[];nextCursor:string|null;}
@Injectable({providedIn:'root'})
export class SystemsApi {
 private readonly http=inject(HttpClient);
 async list(q='',after?:string):Promise<SystemPage>{
  let params=new HttpParams().set('limit',20);
  if(q.trim())params=params.set('q',q.trim());
  if(after)params=params.set('after',after);
  return firstValueFrom(this.http.get<SystemPage>('/bff/api/systems',{params}));
 }
}
