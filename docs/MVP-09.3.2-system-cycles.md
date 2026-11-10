# MVP-09.3.2 — Ciclos por sistema (consulta + alta inactiva)

Estado: **código propuesto en rama**, pendiente de pruebas locales e integración. Alcance limitado a `jesusmarin/miec-dashboard`; el motor `jesusmarin/miec` no se modifica.

## Contratos verificados del motor

- `GET /api/systems/{systemId}`: detalle de sistema existente; roles AUTHOR y APPROVER.
- `GET /api/systems/{systemId}/cycles?limit=20[&after=cursor]`: `CyclePage {items: CycleView[], nextCursor: string|null}`; roles AUTHOR y APPROVER.
- `POST /api/systems/{systemId}/cycles`: comando `{configurationVersionId:string|null}`, máximo 100 caracteres; solo AUTHOR; respuesta HTTP 201 con `CycleView`.
- `CycleView`: cycleId, systemId, cycleNumber, state, autonomyLevel, configurationVersionId, startedAt, createdAt, updatedAt, version.
- El motor asigna estado inicial inactivo, autonomía A0, identificador, número de ciclo y versión. La UI nunca envía esos valores.
- Todos los endpoints llegan al navegador mediante mismo origen bajo `/bff/api/`. No se exponen credenciales Basic.

## Interfaz y seguridad

1. En `/systems` aparece «Ver ciclos» para cada sistema, independientemente del rol.
2. Ruta protegida `/systems/:systemId/cycles`, con enlace de retorno.
3. Ambos roles ven detalle de sistema, ciclos, estado, autonomía, versión, fecha de creación e inicio, y paginación con cursor del motor.
4. AUTHOR ve formulario «Nuevo ciclo»; `configurationVersionId` opcional (máximo 100 caracteres); crea ciclo inactivo y refresca la lista.
5. APPROVER no ve el formulario, y BFF rechaza `POST /api/systems/{uuid}/cycles` con `403 {code:FORBIDDEN}` aun con sesión y XSRF válidos. Spring Boot conserva la autorización definitiva.
6. No se implementan `startCycle`, ediciones, decisiones ni transiciones; esos comandos requieren análisis y aceptación separados.
7. La UI comunica errores de consulta, sistema inexistente y creación; no inventa estados.

## Criterios de aceptación

| ID | Comprobación | Evidencia esperada |
|---|---|---|
| CA-C01 | AUTHOR y APPROVER abren «Ver ciclos» del sistema de prueba | Pantalla del sistema y lista |
| CA-C02 | Un sistema recién creado muestra lista vacía | «Todavía no tiene ciclos» |
| CA-C03 | AUTHOR crea un ciclo sin versión de configuración | HTTP 201 y ciclo #1 persistido |
| CA-C04 | El ciclo aparece inactivo, autonomía A0 y sin fecha de inicio | UI y GET real |
| CA-C05 | APPROVER ve ciclo pero no formulario de creación | UI |
| CA-C06 | APPROVER con XSRF válido intenta POST directo | HTTP 403, código FORBIDDEN |
| CA-C07 | Paginación conserva el cursor ligado al sistema | Al menos 21 ciclos de laboratorio |
| CA-C08 | Sistema inexistente | Mensaje de error, GET 404 |
| CA-C09 | `npm run build` + `npm run test:bff` | Compilación y 9/9 pruebas |
| CA-C10 | Motor MIEC sin cambios | Comparación de repositorios |

## Comandos locales

```powershell
git status --short
git fetch origin
git switch feature/mvp-09-3-2-system-cycles
npm run test:bff
npm run build

# Reiniciar el BFF anterior para servir los nuevos archivos dist.
# Las credenciales de BFF deben permanecer configuradas en la consola.
npm run serve:secure
```

Abrir `http://127.0.0.1:4300` y consultar el sistema de laboratorio «MIEC - Sistema de prueba 001». Para crear ciclos, acceder como AUTHOR y usar «Crear ciclo inactivo»; no iniciar ciclos con este incremento.

## Límites de evidencia

Los tests nuevos son unitarios/integración BFF con `fetcher` simulado; se requiere prueba contra Spring Boot real y base de laboratorio. No se ejecutaron compilación Angular ni pruebas BFF desde el conector de GitHub.
