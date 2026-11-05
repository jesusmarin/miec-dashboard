import { HttpInterceptorFn } from '@angular/common/http';
// Angular solo añade XSRF automáticamente a peticiones relativas; este interceptor
// está reservado para trazabilidad y no inventa ni expone credenciales Basic.
export const csrfInterceptor:HttpInterceptorFn = (req,next)=>next(req);
