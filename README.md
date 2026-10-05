# Prompt maestro: infoproducto seguro en Netlify

Harness en español para que una IA con acceso a archivos, terminal y navegador construya un infoproducto modular con:

- experiencia pública;
- checkout demostrativo;
- acceso con Google;
- permisos de comprador persistidos del lado servidor;
- portal protegido por Netlify antes de entregar el archivo.

El objetivo no es enseñar programación tradicional. El creador define el producto y la IA se ocupa de la implementación, las pruebas y la configuración guiada.

## Usarlo en cuatro pasos

1. Hacé un **fork** de este repositorio en tu cuenta de GitHub.
2. Cloná tu fork con GitHub Desktop.
3. Abrí esa carpeta en Codex, Claude Code/Claude Desktop, Gemini CLI o un harness equivalente con acceso real al workspace.
4. Copiá [PROMPT_MAESTRO_INFOPRODUCTO_SEGURO_NETLIFY.md](PROMPT_MAESTRO_INFOPRODUCTO_SEGURO_NETLIFY.md) como primer mensaje y respondé su entrevista comercial.

Si nunca usaste GitHub, empezá por [GUIA_INICIO_GITHUB_Y_HARNESS.md](GUIA_INICIO_GITHUB_Y_HARNESS.md).

## Qué quedó validado

El 28 de agosto de 2026 se verificó un recorrido publicado completo:

- el checkout DEMO registró el derecho de compra;
- Google confirmó la identidad;
- los hooks de Netlify Identity asignaron `buyer` automáticamente sólo al comprador;
- el comprador abrió el portal y descargó un recurso protegido;
- otra cuenta de Google autenticada, sin compra, quedó bloqueada;
- sin sesión, `/portal`, `/portal/` y `/portal.html` respondieron `401`.

Esto es un **PASS técnico del circuito demostrativo**, no una certificación automática de producción ni un reemplazo de un checkout real.

## La idea que no se negocia

Autenticarse demuestra quién sos. No demuestra que compraste. La autorización ocurre cuando el servidor cruza esa identidad con un derecho de compra y Netlify decide si entrega o no el contenido.

## Licencia y uso

Material educativo de Ramiro Cerrato. Podés duplicarlo y personalizarlo para trabajar durante la clase. No publiques contraseñas, tokens, API keys ni archivos `.env` en GitHub.
