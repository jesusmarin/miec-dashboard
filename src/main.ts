import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient, withInterceptors, withXsrfConfiguration } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { csrfInterceptor } from './app/core/api/csrf.interceptor';
bootstrapApplication(AppComponent, { providers: [
  provideRouter(routes),
  provideHttpClient(withXsrfConfiguration({cookieName: 'MIEC-XSRF-TOKEN', headerName: 'X-CSRF-Token'}), withInterceptors([csrfInterceptor]))
]}).catch(() => { document.body.textContent = 'No se pudo iniciar MIEC Dashboard'; });
