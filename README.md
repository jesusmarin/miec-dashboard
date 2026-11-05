# MVP-09.2 — MIEC Dashboard (Angular + BFF local)

**Alcance:** inicio de sesión, sesión HttpOnly SameSite=Strict, CSRF, proxy autenticado de mismo origen y consulta real del catálogo de sistemas. No incluye mutaciones de dominio ni integración E2E de rondas. **No es producción.**

## Entorno
- Angular 21.2 (LTS), Node 22.12+ compatible. npm y acceso al registro de paquetes para instalar.
- MIEC API instalada y activa en http://127.0.0.1:8081; cuentas AUTHOR y APPROVER configuradas en el servidor.
- El BFF no almacena contraseñas en el navegador ni en el estado de la sesión. Lee las cuentas del motor desde variables del proceso.

## Arranque en Windows PowerShell
```powershell
cd miec-dashboard
npm install
npm run build
$env:MIEC_AUTHOR_USERNAME = 'author'
$env:MIEC_APPROVER_USERNAME = 'approver'
$author = Get-Credential -UserName 'author'
$approver = Get-Credential -UserName 'approver'
$env:MIEC_AUTHOR_PASSWORD = $author.GetNetworkCredential().Password
$env:MIEC_APPROVER_PASSWORD = $approver.GetNetworkCredential().Password
$env:MIEC_ENGINE_ORIGIN = 'http://127.0.0.1:8081'
npm run serve:secure
```
Abrir **http://127.0.0.1:4300**. No abrir Angular en `:4200` para operaciones autenticadas: el BFF sirve el build estático y actúa como único origen.

## Pruebas
```powershell
npm run test:bff
npm run build
```
El paquete no incluye `node_modules` ni `package-lock.json` porque las dependencias no se instalaron aquí. Resolver y **fijar** el lockfile antes del primer commit. Las pruebas de navegador contra MIEC real y las pruebas de seguridad HTTP completas siguen pendientes de ejecutar en Windows.

## Diseño / límites
- `POST /bff/login` acepta credenciales solo en loopback, valida frente a las cuentas del motor y abre una sesión volátil; tras reiniciar el BFF se pierde la sesión.
- `GET /bff/session` devuelve usuario/rol; `POST /bff/logout` exige X-CSRF-Token.
- `/bff/api/...` se envía a `/api/...` de MIEC por un proxy allowlist; el BFF añade Basic exclusivamente del lado del servidor.
- CSRF con token sincronizador cookie legible + cabecera obligatoria para cualquier POST autenticado. Cookie de sesión HttpOnly, SameSite=Strict, Path=/; `Secure` solo es viable en HTTPS. HTTP loopback es **exclusivo de laboratorio**.
- No habilita CORS, accesos remotos, identidades multiusuario ni tokens externos. Proteger el equipo local y los procesos de desarrollo.
- Si se desea empaquetar el BFF como módulo Spring Boot, se requiere ADR y nueva batería de regresión; este BFF Node es independiente y no toca F01/F02/IR-009.
