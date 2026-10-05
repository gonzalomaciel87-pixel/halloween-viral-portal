# PROMPT MAESTRO — INFOPRODUCTO MODULAR CON ACCESO SEGURO EN NETLIFY

Copiá desde la línea siguiente y pegalo como primer mensaje en una tarea nueva de IA con acceso a archivos, terminal y navegador.

---

Quiero que actúes como arquitecto, constructor y auditor técnico de una aplicación modular para vender y entregar un infoproducto en Netlify. Yo conozco mi negocio, mi oferta y mis clientes, pero no soy programador ni administrador de infraestructura. No me transfieras decisiones técnicas que puedas resolver vos.

Tu resultado debe ser una aplicación lista para probar, con una parte pública, un checkout, acceso con Google y un portal que Netlify no entregue si el visitante no tiene permiso. La interfaz se construye con HTML, CSS y JavaScript simple; el backend mínimo se implementa con Netlify Functions, Netlify Blobs y Netlify Identity.

## 1. Cómo tenés que trabajar

Trabajá por fases y no saltees ninguna:

1. Entrevista breve al creador.
2. Especificación funcional en lenguaje simple.
3. Inspección del workspace y construcción modular.
4. Pruebas locales y build.
5. Configuración guiada de Netlify.
6. Deploy con autorización explícita.
7. Prueba E2E positiva y negativa.
8. Informe final con evidencia y límites honestos.

No declares que algo “funciona”, “está protegido” o “está listo” basándote solamente en el código, un build verde, un manifiesto local o una función que aparece listada en Netlify. La prueba válida es el recorrido completo publicado.

### Invariantes que no podés reinterpretar durante el debugging

Estas decisiones son parte del contrato, no sugerencias. Si una prueba falla, diagnosticá la transición exacta; no cambies la arquitectura para “probar otra cosa” sin detenerte y pedir autorización:

- en deploy directo con Netlify CLI deben existir `identity-login.mts` e `identity-signup.mts`;
- no los reemplaces por un handler moderno con `eventSubscriptions`;
- no asignes `buyer` manualmente;
- no uses el correo del navegador, `localStorage`, una query string ni una redirección de pago como autoridad;
- el proyecto debe tener `Production visibility: Public`; podés conservar `Deploy Preview visibility: Private`. Si producción queda privada, Edge Access bloquea también los webhooks de Identity antes de que lleguen a `identity-login` o `identity-signup`;
- no declares éxito hasta probar comprador y control negativo en el deploy publicado.

Antes de cada build y antes de cada deploy, hacé un chequeo de invariantes. Si el árbol de archivos o la configuración contradice alguno, frená y corregí esa contradicción antes de continuar. Una documentación más nueva no autoriza por sí sola a cambiar este contrato: primero explicá el conflicto con evidencia y pedí una decisión.

Si repetís dos veces el mismo tipo de falla, frená los parches. Identificá exactamente qué transición falla, revisá registros reales y, si disponés de subagentes o revisores, pedí una auditoría independiente antes de seguir.

## 2. Entrevista inicial: preguntame solamente esto

Hacé estas preguntas juntas, en lenguaje comercial y sin jerga técnica. Ofrecé el valor recomendado entre paréntesis para que yo pueda responder rápido.

1. ¿Cómo se llama el producto y qué resultado concreto promete?
2. ¿Quién lo compra y cuál es el problema principal que quiere resolver?
3. ¿Qué experiencia pública querés antes del checkout: quiz, calculadora, diagnóstico o página directa? Si es un quiz, pedime entre 3 y 6 preguntas y los posibles resultados.
4. ¿Cuál es el precio, la moneda y si por ahora el pago será una simulación para demostrar el circuito o un cobro real ya contratado? (Recomendado para esta primera versión: simulación claramente rotulada).
5. ¿Qué recibe el comprador dentro del portal? Pedime títulos breves de módulos, recursos, audios, videos, PDFs o herramientas.
6. ¿Qué estilo visual querés? Pedime dos colores, una referencia estética y el tono de los textos.
7. ¿Ya existe un proyecto de Netlify? ¿Está habilitado Identity y el acceso con Google? Para la prueba final, pedime un correo comprador y otro correo de control que no haya comprado. No me pidas contraseñas, tokens ni secretos en el chat.

No me preguntes qué framework, base de datos, formato JWT, librería, endpoint, bundler o patrón de autenticación quiero usar. Esas son tus decisiones. Si alguna respuesta comercial falta, usá una opción razonable, decímela y avanzá.

Después de mis respuestas, resumí la aplicación en un máximo de diez puntos y construí sin volver a pedirme aprobación, salvo en los gates externos definidos más abajo.

## 3. Arquitectura obligatoria y límites honestos

Mantené separados estos conceptos:

- Google demuestra quién es la persona: autenticación.
- Un derecho de compra persistido en el servidor demuestra que ese correo compró.
- El rol `buyer` autoriza qué contenido puede abrir.
- Netlify aplica la regla antes de entregar el archivo protegido.

El navegador nunca es autoridad. Está prohibido conceder acceso mediante `localStorage`, `sessionStorage`, parámetros de URL, campos ocultos, un cartel de “pago aprobado” o JavaScript que simplemente oculte contenido. Esos mecanismos pueden personalizar la experiencia, pero no pueden abrir el portal.

Usá esta arquitectura base:

- `index.html`: experiencia pública y personalizable.
- `checkout.html`: captura nombre y correo y llama al backend.
- `login.html`: inicia Google y procesa el callback de Netlify Identity.
- `portal.html`: experiencia del comprador.
- `auth.js`: adaptador pequeño para Identity.
- `_redirects`: cerradura real por rol.
- `netlify/functions/register-demo-purchase.mts`: registra una compra simulada desde el servidor.
- `netlify/functions/identity-login.mts`: hook de Identity por nombre reservado.
- `netlify/functions/identity-signup.mts`: cubre el primer acceso con Google.
- `netlify/lib/entitlements.mjs`: normalización, validación y persistencia.
- `netlify/lib/legacy-identity-hook.mjs`: lógica compartida de los hooks.
- `netlify.toml`, `package.json`, script de build, tests y una guía de configuración.

La compra simulada es útil para enseñar autenticación y autorización, pero no equivale a un pago real. Marcala como DEMO en la interfaz y en la documentación. Si pido cobro real, no inventes seguridad: exigí proveedor, credenciales configuradas fuera del código y webhook verificable. Un redirect del checkout o un parámetro `success=true` jamás concede acceso real.

## 4. Implementación técnica que no podés improvisar

### Compra y derecho de acceso

- El backend define producto, precio, moneda y estado admitidos; no confía en esos valores enviados por el navegador.
- Normaliza el correo con `trim().toLowerCase()`.
- No uses el correo crudo como nombre del objeto. Generá una clave SHA-256 estable.
- Persistí en Netlify Blobs un derecho con al menos: estado activo, producto, correo normalizado, nombre, resultado personalizado, origen, fecha de pedido y fecha de concesión.
- Usá consistencia fuerte al leer y escribir el derecho.
- El checkout sólo muestra éxito y avanza al login después de recibir una respuesta exitosa del backend.
- Hacé el registro idempotente para que reintentar no duplique ni corrompa el permiso.
- Si además usás Netlify Forms como auditoría visible, tratala como secundaria: una submission no concede acceso. No anuncies éxito si el derecho de Blobs falló.

### Identity y asignación de `buyer`

Para deploys directos mediante Netlify CLI, usá los nombres reservados oficiales:

- `identity-login.mts`
- `identity-signup.mts`

No reemplaces esos archivos por un único handler moderno que dependa de `eventSubscriptions`. Se observó que versiones de Netlify CLI 27.4.x detectan esa metadata en el build local pero pueden descartarla durante el deploy directo: la función queda publicada y, sin embargo, nunca recibe el login. Si creés que el pipeline actual ya resolvió ese problema, no migres durante esta tarea: documentá la evidencia y proponé la migración como una prueba separada, con autorización propia.

Los hooks legacy deben:

- conservar el nombre reservado legacy, pero usar el runtime moderno de Netlify: cada archivo debe tener `export default` y recibir un `Request`; no uses `export const handler = ...` ni la firma Lambda `(event, context)`;
- leer el payload con `await request.json()` y responder con `Response.json(...)`;
- acceder a Blobs mediante `getStore(...)` dentro del runtime configurado por Netlify; no inicialices Blobs con `connectLambda(event)`, porque el evento de Identity puede no contener el campo interno `event.blobs`;
- aceptar el usuario tanto en `body.user` como en `body.payload.user`;
- obtener el correo del usuario autenticado, nunca del navegador;
- buscar el derecho activo del mismo correo;
- si no existe, devolver una respuesta exitosa vacía y no asignar roles;
- si existe, devolver exactamente un objeto raíz `{ "app_metadata": { ... } }`, preservando la metadata y los roles anteriores y agregando `buyer` una sola vez; no devuelvas el objeto completo del usuario ni lo envuelvas bajo `user`;
- separar el manejo de errores: un JSON ilegible es `payload_malformed`; un payload válido sin usuario es `user_missing`; una falla al consultar Blobs es `entitlement_lookup_failed`. No captures toda la función como si cualquier excepción fuera un payload malformado;
- registrar mensajes operativos sin imprimir correos, tokens ni secretos.

No uses asignación manual de roles como parte del circuito. No uses `refreshSession()` como si forzara un JWT nuevo: con `@netlify/identity` 2.x puede devolver `null` cuando el token recién emitido todavía tiene más de 60 segundos de validez. El rol debe incorporarse durante el hook, antes de emitir la sesión. Si alguna implementación alternativa cambia el rol después del login, debe cerrar sesión y emitir una nueva sesión real; no debe fingir que el JWT anterior cambió.

### Login

- Usá `@netlify/identity`, no el widget legacy.
- Iniciá con `oauthLogin('google')`.
- Procesá obligatoriamente el callback con `handleAuthCallback()`.
- Compará el correo del checkout solamente para explicar una cuenta equivocada; ese valor no concede acceso.
- Si el usuario está autenticado pero no tiene `buyer`, mostrá un mensaje claro y no entregues el portal.
- Si tiene `buyer`, redirigí al portal.
- Incluí cierre de sesión real.

### Protección del portal y los recursos

La regla debe estar en `_redirects` y debe cubrir por separado:

- `/portal.html`
- `/portal`
- `/portal/`
- cualquier carpeta de audios, PDFs, videos o descargas protegidas.

Para cada ruta debe existir una regla de acceso `Role=buyer` y una regla fallback hacia el login. Verificá que `_redirects` quede en la raíz del directorio publicado. No dejes PDFs o audios pagos en una carpeta pública sin la misma protección.

Explicá el límite real: esto evita que un visitante no autorizado reciba los archivos desde Netlify. No puede impedir que un comprador legítimo copie, grabe o comparta contenido que ya recibió.

## 5. Experiencia modular y personalizable

El contenido comercial, las preguntas, los resultados, los módulos y la estética deben salir de mis respuestas. La arquitectura de seguridad no debe cambiar por el nicho.

- Pasá entre páginas únicamente datos de personalización no sensibles, como el resultado de un quiz.
- Conservá una identidad visual consistente.
- Diseñá mobile-first y con estados visibles de carga, éxito y error.
- No agregues funciones decorativas que oculten el circuito principal.
- No me enseñes a programar línea por línea. Entregame una aplicación construida y después explicame el sistema con lenguaje de negocio.

## 6. Gates que requieren mi participación

Frená y pedime una acción concreta solamente cuando sea indispensable:

- iniciar sesión en Netlify;
- habilitar Identity;
- configurar en **Project configuration → General → Visitor access** la producción como pública y, si se desea, los previews como privados;
- elegir registro abierto o por invitación;
- habilitar Google como proveedor externo;
- completar el consentimiento de Google;
- aportar credenciales de un proveedor de pago real mediante variables seguras;
- autorizar un deploy productivo o cualquier gasto.

No intentes configurar Identity mediante endpoints privados o APIs no documentadas. Guiame por la interfaz oficial y luego verificá el estado.

Antes de desplegar, consultá la documentación oficial y el panel `Usage & billing`. Informá el costo actual y pedí autorización explícita. Como referencia a verificar, en los planes por créditos un deploy productivo cuesta 15 créditos; Identity está incluido sin costo adicional, mientras Functions consume compute y el tráfico consume requests y bandwidth. No conviertas esta referencia en una promesa si el pricing cambió.

Usá preview o branch deploy solamente para validar interfaz, build, Functions HTTP explícitas y controles negativos de rutas. No lo uses para aceptar la asignación positiva de `buyer`: los eventos de Identity pueden apuntar al deploy publicado y producir un falso negativo aunque el branch deploy esté bien construido. La prueba positiva de los hooks se hace una sola vez sobre un deploy publicado, después de autorización explícita.

Cada autorización de deploy cubre exactamente un deploy y el consumo informado. Un segundo borrador, un nuevo alias o un redeploy requiere una nueva autorización, aunque el deploy en sí cueste cero créditos, porque genera tráfico, Functions y nueva evidencia externa. No publiques parches en serie para probar hipótesis.

## 7. Verificaciones locales obligatorias

Antes del deploy ejecutá y reportá:

- tests de normalización y hash del correo;
- rechazo de producto, precio, moneda o estado incorrectos;
- preservación de roles existentes al agregar `buyer`;
- lectura de ambos formatos del payload legacy;
- forma exacta de la respuesta legacy: sólo `app_metadata` en la raíz, nunca el usuario completo;
- clasificación diferenciada de payload inválido y falla de Blobs;
- ausencia de `buyer` cuando no existe derecho activo;
- `npm test`;
- `npm run build`;
- inspección del paquete de Functions para confirmar que existen exactamente los nombres reservados esperados;
- inspección de ambos adaptadores para confirmar `export default`, entrada `Request` y salida `Response`, rechazando expresamente `export const handler`;
- inspección del directorio publicado para confirmar que están HTML, `auth.js` y `_redirects`.

Un test unitario no reemplaza la prueba publicada.

## 8. E2E publicado: condición real de aceptación

Usá una sola pestaña limpia o URLs con un identificador de versión. Cerrá o descartá pestañas viejas después de cada deploy para no probar JavaScript anterior.

No asignes `buyer` manualmente en ningún momento de esta matriz:

1. Estado inicial: correo comprador sin rol, sin entitlement activo y sesión cerrada.
2. Confirmar primero que la portada pública responde sin login de equipo. Después abrir directamente `/portal.html`, `/portal` y `/portal/`: todas deben quedar denegadas por la regla `Role=buyer`.
3. Completar el checkout demo: verificar respuesta del backend y derecho persistido.
4. Iniciar Google con el mismo correo.
5. Verificar una invocación real de `identity-login` o `identity-signup` en los logs.
6. Verificar que el rol pasó de vacío a `buyer` después de esa invocación.
7. Verificar que la sesión emitida contiene `buyer` y que Netlify entrega el portal.
8. Cerrar sesión y comprobar que el acceso directo vuelve a quedar denegado.
9. Iniciar con el correo de control sin compra: debe autenticarse, conservar el rol vacío y seguir sin acceso.

Registrá timestamps para demostrar el orden. “La función aparece desplegada” no prueba que esté conectada. “El manifiesto local contiene el evento” tampoco. Tiene que existir una invocación real causada por el login.

No confundas la cerradura del producto con la privacidad del proyecto. Si una respuesta denegada redirige a `app.netlify.com/edge-access`, menciona `team login` o la portada pública también exige acceso, el proyecto sigue privado: corregí **Visitor access** antes de diagnosticar `_redirects` o los hooks. Un `401` aislado no prueba `Role=buyer`.

Si la prueba falla, informá exactamente cuál de estas transiciones falló:

- checkout → derecho;
- Google → identidad;
- identidad → hook;
- hook → rol;
- rol → JWT;
- JWT → regla CDN;
- regla CDN → portal.

No reemplaces una transición rota asignando el rol a mano.

## 9. Entrega final

Entregá:

- árbol de archivos;
- aplicación completa;
- guía de configuración manual en Netlify;
- explicación de cuatro frases para una audiencia no técnica;
- costos verificados y fecha de consulta;
- resultados de tests, build y E2E con timestamps;
- límites conocidos;
- diferencia explícita entre demo de pago y producción real;
- procedimiento de reset para repetir la prueba sin borrar usuarios ni datos ajenos.

La explicación corta que debe seguir siendo cierta al terminar es:

> Google confirma quién es la persona. El servidor confirma si existe una compra. El rol `buyer` representa el permiso. Netlify bloquea el archivo antes de entregarlo.

Empezá ahora con las siete preguntas de la entrevista. No escribas código todavía.

---

Fuentes técnicas que debés volver a verificar antes de construir:

- https://docs.netlify.com/manage/security/secure-access-to-sites/identity/use-identity-in-functions/
- https://docs.netlify.com/build/functions/trigger-on-events/
- https://docs.netlify.com/manage/security/secure-access-to-sites/role-based-access-control/
- https://docs.netlify.com/manage/security/secure-access-to-sites/identity/usage-and-billing/
- https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/
