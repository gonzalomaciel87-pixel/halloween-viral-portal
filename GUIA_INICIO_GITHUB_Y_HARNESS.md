# Guía inicial: GitHub + tu harness de IA

Esta guía evita el error más común: intentar “conectar mágicamente la IA con GitHub”. El circuito real es más simple:

**GitHub guarda el proyecto en internet → GitHub Desktop lo sincroniza → la IA trabaja sobre la carpeta local.**

Codex, Claude o Gemini no necesitan conocer tu contraseña de GitHub. Tampoco tenés que pegar tokens en el chat.

## 1. Crear la cuenta de GitHub

1. Entrá a [github.com/signup](https://github.com/signup).
2. Creá tu cuenta o elegí **Continue with Google**.
3. Verificá tu correo. Sin correo verificado, GitHub restringe operaciones básicas como crear repositorios.

Referencia oficial: [Crear una cuenta personal de GitHub](https://docs.github.com/en/account-and-profile/how-tos/account-management/creating-an-account-on-github).

## 2. Instalar GitHub Desktop

GitHub Desktop permite clonar, actualizar y publicar sin memorizar comandos.

1. Descargalo desde [desktop.github.com](https://desktop.github.com/).
2. Abrilo y elegí **Sign in to GitHub.com**.
3. Autorizá la aplicación en el navegador.
4. Conservá el método HTTPS recomendado por GitHub Desktop.

Referencia oficial: [Conectar GitHub Desktop con tu cuenta](https://docs.github.com/en/desktop/installing-and-authenticating-to-github-desktop/about-connections-to-github-in-github-desktop).

## 3. Crear tu propia copia del harness

No trabajes directamente sobre el repositorio del docente.

1. Abrí [ramiaguero/prompt-infoproducto-seguro-netlify](https://github.com/ramiaguero/prompt-infoproducto-seguro-netlify).
2. Tocá **Fork**.
3. Dejá seleccionada tu cuenta y confirmá **Create fork**.
4. En tu fork, tocá **Code → Open with GitHub Desktop**.
5. Elegí una carpeta fácil de encontrar y presioná **Clone**.

Un fork es tu propia copia. Clonar descarga esa copia a tu computadora. Referencia oficial: [Clonar y hacer fork con GitHub Desktop](https://docs.github.com/en/desktop/adding-and-cloning-repositories/cloning-and-forking-repositories-from-github-desktop).

## 4. Abrir la carpeta en tu IA

Elegí un solo harness. Los tres deben trabajar sobre **la carpeta que acabás de clonar**, no sobre una copia suelta del prompt.

### Codex

1. Abrí Codex.
2. Elegí **Choose project / On my computer**.
3. Seleccioná la carpeta clonada.
4. Creá una tarea nueva y pegá el contenido completo de `PROMPT_MAESTRO_INFOPRODUCTO_SEGURO_NETLIFY.md`.

La documentación oficial de Codex muestra el flujo de seleccionar un proyecto local desde **On my computer**: [Codex overview](https://learn.chatgpt.com/docs).

### Claude

En Claude Desktop, elegí la carpeta del proyecto cuando inicies una sesión de código. Si usás Claude Code desde una terminal abierta en esa carpeta, ejecutá `claude`, iniciá sesión cuando lo solicite y pegá el prompt maestro.

En Windows, Claude Code puede instalarse con WinGet y después se inicia dentro de la carpeta del proyecto. Referencia oficial: [Claude Code — getting started](https://code.claude.com/docs/en/getting-started).

### Gemini

En Gemini/Antigravity, abrí la carpeta clonada como workspace. Si usás Gemini CLI, abrí una terminal en esa carpeta, ejecutá `gemini`, completá el método de autenticación disponible para tu cuenta y pegá el prompt maestro.

La disponibilidad y el método de autenticación pueden variar según el tipo de cuenta. Referencia oficial: [Gemini CLI — getting started](https://google-gemini.github.io/gemini-cli/docs/get-started/).

## 5. Confirmar que la IA está trabajando en el lugar correcto

Antes de construir, escribile:

> Confirmá la ruta del proyecto, mostrame el estado de Git y verificá que existe `PROMPT_MAESTRO_INFOPRODUCTO_SEGURO_NETLIFY.md`. No modifiques nada todavía.

La respuesta debe mostrar la carpeta clonada y el archivo del prompt. Si aparece otra carpeta, frená y corregí el workspace.

## 6. Actualizar y guardar sin usar comandos

En GitHub Desktop:

- **Fetch origin / Pull origin** trae cambios de GitHub a tu computadora.
- **Commit to main** guarda un conjunto de cambios con una descripción.
- **Push origin** sube tus commits a tu fork.

Antes de hacer push, revisá la lista de archivos. Nunca subas `.env`, contraseñas, tokens, API keys, credenciales de Netlify ni datos de compradores reales.

## Qué significa realmente “estar conectado”

Si la IA puede leer y modificar la carpeta clonada, y GitHub Desktop puede hacer pull y push de esa carpeta, el circuito está conectado. No hace falta darle a la IA acceso total a tu cuenta de GitHub para construir la aplicación.
