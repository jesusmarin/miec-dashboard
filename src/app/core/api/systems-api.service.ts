import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

/** Contrato de navegación MVP09-NAVIGATION-01. */
export interface SystemSummary {
  systemId: string;
  name: string;
  domain: string | null;
  status: string;
  createdAt: string;
  cycleCount: number;
  cyclesByState: Record<string, number>;
  lastActivityAt: string | null;
  recentCycle: {
    cycleId: string;
    cycleNumber: number;
    state: string;
    version: number;
    lastActivityAt: string | null;
  } | null;
}

export interface SystemPage {
  items: SystemSummary[];
  nextCursor: string | null;
}

/** Campos exactos de LifecycleCommands.CreateSystem del motor MIEC. */
export interface CreateSystemCommand {
  name: string;
  domain: string | null;
  description: string | null;
  ownerReference: string | null;
}

/** Representación devuelta por POST /api/systems (HTTP 201). */
export interface SystemView {
  systemId: string;
  name: string;
  domain: string | null;
  description: string | null;
  ownerReference: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class SystemsApi {
  private readonly http = inject(HttpClient);

  async list(q = '', after?: string): Promise<SystemPage> {
    let params = new HttpParams().set('limit', 20);
    if (q.trim()) params = params.set('q', q.trim());
    if (after) params = params.set('after', after);
    return firstValueFrom(this.http.get<SystemPage>('/bff/api/systems', { params }));
  }

  /** Solo AUTHOR puede registrar un sistema; el motor vuelve a validar el rol. */
  async create(command: CreateSystemCommand): Promise<SystemView> {
    return firstValueFrom(this.http.post<SystemView>('/bff/api/systems', command));
  }
}
