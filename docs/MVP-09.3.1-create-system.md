# MVP-09.3.1 — Registrar un sistema MIEC desde Angular

Estado: **implementación propuesta para revisión**, pendiente de compilación Angular, ejecución de pruebas y validación local contra MIEC real.

## Alcance y dependencias

El incremento incorpora la alta de un sistema desde `/systems` **solo para AUTHOR**. No modifica el repositorio del motor `jesusmarin/miec` ni sus contratos, sus migraciones, F01, F02 o IR-009.

Contrato existente en MIEC: `POST /api/systems`; el BFF enruta `POST /bff/api/systems`.

| Campo | Regla en Angular | Contrato del motor |
|---|---|---|
| `name` | Obligatorio, sin solo espacios, máximo 255 | `@NotBlank @Size(max=255)` |
| `domain` | Opcional, máximo 100 | `@Size(max=100)` |
| `description` | Opcional, máximo 4000 | `@Size(max=4000)` |
| `ownerReference` | Opcional, máximo 255 | `@Size(max=255)` |

Los espacios externos se normalizan, y los campos opcionales vacíos se envían como `null`. El servidor asigna `systemId`, `status`, marcas temporales y responde HTTP 201. No se simulan estos campos en Angular.

## Comportamiento

1. AUTHOR ve «Nuevo sistema» en `/systems`; APPROVER no ve esta opción.
2. AUTHOR abre formulario standalone con Reactive Forms, validación y botón de cancelación.
3. El envío usa `SystemsApi.create()`, `HttpClient` y la sesión existente del BFF, con la protección XSRF ya configurada.
4. El BFF rechaza explícitamente `POST /api/systems` para APPROVER (403), antes de reenviar la solicitud. Spring Boot mantiene su autorización propia y definitiva.
5. Tras HTTP 201 se cierra el formulario, se limpia el filtro de búsqueda, se recarga la primera página del catálogo y se informa la creación.
6. Ante 400, 401, 403, 409 o fallos de conexión, el formulario conserva datos y muestra un mensaje sin revelar credenciales o detalles técnicos.
7. Se impiden envíos duplicados mientras una solicitud está pendiente, sin presentar esto como una garantía de idempotencia del servidor.

## Archivos

- `src/app/core/api/systems-api.service.ts`: contratos de creación y método POST.
- `src/app/features/systems/create-system.component.ts`: formulario.
- `src/app/features/systems/systems.component.ts`: visibilidad de AUTHOR, integración y actualización del catálogo.
- `bff/server.mjs`: denegación defensiva de la creación para APPROVER.
- `bff/server.test.mjs`: dos escenarios nuevos de autorización y CSRF.

## Aceptación

| ID | Criterio | Evidencia requerida |
|---|---|---|
| CA-01 | AUTHOR ve y abre el formulario | Navegador `/systems` |
| CA-02 | Nombre vacío o con espacios impide enviar | Prueba UI |
| CA-03 | Se respetan límites de campos y opcionales vacíos | Prueba UI + petición |
| CA-04 | AUTHOR crea y el motor responde HTTP 201 | Network y consulta posterior |
| CA-05 | El nuevo sistema aparece tras recargar la colección | Pantalla + GET |
| CA-06 | APPROVER no ve la opción y un POST directo obtiene 403 | UI + API negativa |
| CA-07 | Sin CSRF hay 403 y sin sesión 401 | Pruebas BFF |
| CA-08 | Error del motor no borra el formulario | Prueba negativa UI |
| CA-09 | `npm run build` y `npm run test:bff` finalizan correctamente | Logs locales |
| CA-10 | Motor MIEC permanece sin modificaciones | Comparación de repositorios |

**Nota:** ocultar el botón es solo experiencia de usuario; los permisos se comprueban en BFF y Spring Boot. Los tests BFF usan un motor simulado y no sustituyen la integración real.

## Pasos de validación Windows

```powershell
# En la carpeta miec-dashboard, sobre la rama propuesta.
npm install
npm run test:bff
npm run build

# Detener el BFF previo con Ctrl+C, manteniendo el motor :8081.
# Credenciales AUTHOR y APPROVER ya configuradas en esta consola.
npm run serve:secure
```

Abrir `http://127.0.0.1:4300/login`, iniciar como AUTHOR, registrar un sistema de prueba y comprobar su aparición. Salir, ingresar como APPROVER y verificar que puede consultar pero no registrar sistemas. No ejecutar creaciones sobre una base de datos que deba permanecer intacta; usar base de laboratorio.

## Pendientes explícitos

- No se ha ejecutado aquí `npm install` ni se dispone de evidencia de compilación Angular o de prueba de navegador.
- Añadir pruebas de componentes Angular (framework de pruebas y dependencias aún no definidos en el repositorio).
- Automatización CI y fijación del lockfile quedan fuera de este incremento.
- El BFF local HTTP/loopback no queda habilitado para producción.
