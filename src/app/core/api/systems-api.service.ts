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


/** Contrato de detalle LifecycleViews.CycleView, también usado por la paginación. */
export interface CycleView {
  cycleId: string;
  systemId: string;
  cycleNumber: number;
  state: string;
  autonomyLevel: string;
  configurationVersionId: string | null;
  startedAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}
export interface CyclePage { items: CycleView[]; nextCursor: string | null; }
export interface CreateCycleCommand { configurationVersionId: string | null; }

@Injectable({ providedIn: 'root' })
export class SystemsApi {
  private readonly http = inject(HttpClient);

  async list(q = '', after?: string): Promise<SystemPage> {
    let params = new HttpParams().set('limit', 20);
    if (q.trim()) params = params.set('q', q.trim());
    if (after) params = params.set('after', after);
    return firstValueFrom(this.http.get<SystemPage>('/bff/api/systems', { params }));
  }

  /** Datos de detalle del sistema; habilitado para ambos roles. */
  async get(systemId: string): Promise<SystemView> {
    return firstValueFrom(this.http.get<SystemView>(
      '/bff/api/systems/' + encodeURIComponent(systemId)));
  }

  /** Cursor opaco ligado al sistema: no reutilizar entre sistemas. */
  async listCycles(systemId: string, after?: string): Promise<CyclePage> {
    let params = new HttpParams().set('limit', 20);
    if (after) params = params.set('after', after);
    return firstValueFrom(this.http.get<CyclePage>(
      '/bff/api/systems/' + encodeURIComponent(systemId) + '/cycles', { params }));
  }

  /** Crea ciclo A0 inactivo; estado, version y numero los asigna el motor. */
  async createCycle(systemId: string, command: CreateCycleCommand): Promise<CycleView> {
    return firstValueFrom(this.http.post<CycleView>(
      '/bff/api/systems/' + encodeURIComponent(systemId) + '/cycles', command));
  }

  /** Solo AUTHOR puede registrar un sistema; el motor vuelve a validar el rol. */
  async create(command: CreateSystemCommand): Promise<SystemView> {
    return firstValueFrom(this.http.post<SystemView>('/bff/api/systems', command));
  }
}
