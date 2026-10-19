# Redmine Pull Requests

[English](README.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | **Español**

[![E2E](https://github.com/aarondpn/redmine_pull_requests/actions/workflows/e2e.yml/badge.svg)](https://github.com/aarondpn/redmine_pull_requests/actions/workflows/e2e.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Redmine 5.0 – 7.0](https://img.shields.io/badge/Redmine-5.0%20%E2%80%93%207.0-b32024)

Vincula pull requests de GitHub y merge requests de GitLab a peticiones de Redmine y muestra su estado, revisiones y comprobaciones directamente en la página de la petición, con el aspecto de GitHub.

![Pull requests en una petición de Redmine](docs/hero.png)

## Funcionalidades

- **Varios pull requests por petición**, y un mismo pull request puede vincularse a varias peticiones
- **GitHub y GitLab** a la vez, incluidos GitHub Enterprise, GitLab autogestionado y los subgrupos de GitLab
- **Estado en tiempo real**: abierto, borrador, fusionado y cerrado, con autor, ramas, commits y estadísticas del diff
- **Detalles de la revisión**: revisores y el estado de su revisión, aprobado / cambios solicitados / revisión requerida, comprobaciones de CI o pipeline de GitLab, comentarios e hilos sin resolver
- **Lista compacta** para peticiones con varios pull requests; cada fila se expande para mostrar todos los detalles
- **Vinculación por URL**: pegue una o varias URL de pull requests o merge requests
- **Repositorios permitidos por proyecto**, para que los webhooks y los vínculos solo lleguen a los proyectos que confían en un repositorio
- **Webhooks**: vinculación automática a partir de `#123` en el título, la descripción o el nombre de la rama, y actualización en tiempo real del estado, las revisiones y las comprobaciones
- **Palabras clave para la corrección**: al fusionar un pull request que dice `Fixes #123` se resuelve la petición, igual que con un commit
- **API REST** para listar, vincular, actualizar y desvincular pull requests desde scripts y CI
- Permisos por perfil, de Redmine 5.0 a 7.0
- **Traducido** al inglés, alemán, francés, español, japonés, chino simplificado, polaco y ruso

### Véalo en acción

![Vinculación de pull requests y despliegue de los detalles](docs/demo.gif)

<table>
  <tr>
    <td width="50%"><img src="docs/details.png" alt="Un pull request con revisores, decisión de revisión, comprobaciones, comentarios e hilos sin resolver"></td>
    <td width="50%"><img src="docs/compact.png" alt="Lista compacta con pull requests de GitHub y un merge request de GitLab"></td>
  </tr>
  <tr>
    <td><b>Todo de un vistazo</b><br>Revisores con el estado de su revisión, decisión de revisión, comprobaciones, comentarios e hilos sin resolver.</td>
    <td><b>Compacto cuando hay mucho movimiento</b><br>Varios pull requests se agrupan en una lista. GitHub y GitLab a la vez.</td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/link.png" alt="Vinculación de pull requests pegando sus URL"></td>
    <td width="50%"><img src="docs/webhook.png" alt="Petición resuelta automáticamente tras fusionar el pull request"></td>
  </tr>
  <tr>
    <td><b>Vinculación por URL</b><br>Pegue una o varias URL de pull requests o merge requests; los detalles se cargan desde la API.</td>
    <td><b>Resuelta al fusionar</b><br>Un pull request fusionado que dice <code>Fixes #123</code> resuelve la petición, vinculada mediante webhook.</td>
  </tr>
</table>

## Compatibilidad

| Redmine | Rails | Probado en CI |
| --- | --- | --- |
| 7.0 | 8.1 | 7.0 |
| 6.0, 6.1 | 7.2 | 6.1 |
| 5.0, 5.1 | 6.1 | 5.1 |

Cada cambio se prueba de extremo a extremo con la última versión menor de cada versión mayor, tanto desde un checkout montado (bind mount) como instalado desde un archivo de versión. El plugin no necesita gems adicionales. Requiere Ruby 2.7 o posterior, lo que solo importa en Redmine 5.0: esa versión todavía admite Ruby 2.5 y 2.6.

## Instalación

Descargue `redmine_pull_requests-vX.Y.Z.tar.gz` de la [última versión](https://github.com/aarondpn/redmine_pull_requests/releases/latest) y extráigalo en el directorio `plugins` de Redmine (o clone allí el repositorio); después ejecute las migraciones. En Redmine 6.0 y posteriores, precompile también los assets:

```sh
cd /path/to/redmine
tar xzf redmine_pull_requests-vX.Y.Z.tar.gz -C plugins
# or: git clone https://github.com/aarondpn/redmine_pull_requests.git plugins/redmine_pull_requests
bundle exec rake redmine:plugins:migrate RAILS_ENV=production
bundle exec rake assets:precompile RAILS_ENV=production   # Redmine 6.0 and newer
```

El directorio del plugin debe llamarse `redmine_pull_requests` (los archivos de versión ya lo contienen). Redmine 6.0+ solo regenera sus assets por sí mismo cuando un archivo de assets es más reciente que la última compilación, y los ficheros que contiene un archivo de versión llevan la fecha de publicación. Sin `assets:precompile`, la hoja de estilos y el script del plugin devuelven 404, de modo que el panel aparece sin estilos y las filas no se pueden expandir.

Reinicie Redmine y, a continuación:

1. Configure el plugin en *Administración » Extensiones » Pull Requests » Configurar*.
2. Conceda **Ver pull requests**, **Administrar pull requests** y **Administrar la configuración de pull requests** a sus perfiles (*Administración » Perfiles y permisos*).
3. Active el módulo **Pull requests** en la configuración del proyecto e indique los repositorios del proyecto en *Proyecto » Configuración » Pull requests* (consulte [repositorios permitidos](#repositorios-permitidos)). Hasta entonces no se puede vincular nada en ese proyecto.

Los archivos de versión incluyen una [atestación de procedencia de compilación](https://docs.github.com/actions/security-for-github-actions/using-artifact-attestations). Verifique una descarga con `gh attestation verify redmine_pull_requests-vX.Y.Z.tar.gz -R aarondpn/redmine_pull_requests`.

### Actualización

Sustituya el directorio del plugin por la nueva versión (o ejecute `git pull`), ejecute `bundle exec rake redmine:plugins:migrate RAILS_ENV=production` y, en Redmine 6.0 y posteriores, `bundle exec rake assets:precompile RAILS_ENV=production`; después reinicie Redmine. Consulte en el [registro de cambios](CHANGELOG.md) los pasos que requiera cada versión.

### Desinstalación

```sh
bundle exec rake redmine:plugins:migrate NAME=redmine_pull_requests VERSION=0 RAILS_ENV=production
rm -r plugins/redmine_pull_requests
```

Esto elimina las tablas del plugin. Reinicie Redmine después.

Redmine conserva algunos elementos que no causan ningún problema: la entrada del módulo *Pull requests* en los proyectos, la configuración del plugin y los assets publicados en `public/plugin_assets/redmine_pull_requests` (Redmine 5) o `public/assets/plugin_assets/redmine_pull_requests` (Redmine 6.0+). Para eliminarlos también:

```sh
bundle exec rails runner -e production "EnabledModule.where(name: 'pull_requests').delete_all; Setting.where(name: 'plugin_redmine_pull_requests').delete_all"
rm -rf public/plugin_assets/redmine_pull_requests public/assets/plugin_assets/redmine_pull_requests
```

## Configuración

GitHub y GitLab tienen cada uno su propia sección en la configuración del plugin:

| Opción | Descripción |
| --- | --- |
| URL / URL de la API | GitHub: `https://github.com`, `https://api.github.com` (Enterprise: `https://github.example.com/api/v3`). GitLab: `https://gitlab.com`, `https://gitlab.com/api/v4`; en instancias autogestionadas también bajo una ruta como `https://example.com/gitlab`. |
| Token de acceso | Consulte [tokens de acceso](#tokens-de-acceso). Necesario para repositorios privados y para actualizar revisiones y comprobaciones desde webhooks. Se puede definir con `REDMINE_PR_GITHUB_TOKEN` / `REDMINE_PR_GITLAB_TOKEN`. |
| Secreto del webhook | Necesario para el webhook. Se puede definir con `REDMINE_PR_GITHUB_WEBHOOK_SECRET` / `REDMINE_PR_GITLAB_WEBHOOK_SECRET`. |

Los tokens y secretos guardados no se muestran en la página de configuración. Deje un campo en blanco para conservar el valor guardado, o marque *Eliminar* para borrarlo. Se filtran del log de Rails; si los define con las variables de entorno `REDMINE_PR_*`, tampoco se guardan en la base de datos.

Opciones de vinculación comunes:

| Opción | Descripción |
| --- | --- |
| Vincular referencias `#123` sin palabra clave | En caso contrario, solo se vinculan las referencias con una de las palabras clave de commit de Redmine (`refs #123`, `fixes #123`). |
| Vincular por nombre de rama | Vincula ramas como `123-login`, `feature/123-login` o `issue-123`. |
| Aplicar las palabras clave para la corrección al fusionar | Usa las *Palabras clave para la corrección* de *Administración » Configuración » Repositorios*. |

### Repositorios permitidos

Cada proyecto decide qué repositorios pueden vincularse a sus peticiones, en *Proyecto » Configuración » Pull requests* (requiere el permiso *Administrar la configuración de pull requests* y el módulo activado). Un patrón por línea, sin distinguir mayúsculas de minúsculas:

- `acme/web`: este repositorio, en GitHub y en GitLab
- `acme/*`: todos los repositorios de `acme` (un nivel)
- `acme/**`: todos los proyectos del grupo de GitLab `acme`, incluidos los subgrupos
- `github:acme/web` o `gitlab:acme/**`: un patrón para un solo proveedor

Las líneas en blanco y las que empiezan por `#` se ignoran. Los webhooks solo vinculan peticiones, y solo aplican las palabras clave para la corrección, en proyectos que permiten el repositorio del pull request; las referencias a peticiones de otros proyectos se ignoran. Los vínculos manuales y la API REST solo aceptan repositorios permitidos. Mientras la lista de un proyecto esté vacía, no se puede vincular nada en él; los pull requests ya vinculados siguen visibles. Los subproyectos no heredan la lista.

Cualquiera con *Administrar pull requests* en un proyecto puede cargar cualquier pull request de los repositorios permitidos del proyecto con el token de acceso configurado, y cualquiera con *Administrar la configuración de pull requests* puede cambiar cuáles son esos repositorios. Conceda ese permiso como cualquier otro derecho de configuración del proyecto y limite el token a los repositorios que deban estar en Redmine.

La lista de permitidos protege frente a pull requests de repositorios en los que un proyecto no confía, por ejemplo forks de un repositorio público. Se basa en el secreto del webhook: hay un secreto por proveedor, y quien lo conozca puede enviar eventos en nombre de cualquier repositorio. Trate los secretos como contraseñas y añada el webhook solo a repositorios y organizaciones cuyos administradores sean de su confianza.

### Tokens de acceso

El plugin solo lee de GitHub y GitLab.

- **GitHub, token fine-grained**: permisos de repositorio *Pull requests* y *Commit statuses*, ambos de solo lectura (*Metadata* de solo lectura se añade automáticamente). GitHub no ofrece el permiso *Checks* para los tokens fine-grained, así que en repositorios privados un token de este tipo no puede cargar las ejecuciones de comprobaciones (check runs, p. ej. de GitHub Actions). Use un token clásico si las necesita.
- **GitHub, token clásico**: el ámbito `repo` para repositorios privados, incluidas las ejecuciones de comprobaciones. Para repositorios públicos no hace falta ningún ámbito.
- **GitLab**: un token de acceso personal, de grupo o de proyecto con el ámbito `read_api`.

Los repositorios públicos funcionan sin token, pero en ese caso GitHub solo permite 60 solicitudes por hora. Si al token le falta un permiso, el plugin omite los detalles que no puede cargar (revisiones, comprobaciones, hilos sin resolver, número de commits en GitLab) y solo escribe el error en el log de Redmine. Si las comprobaciones no aparecen, revise primero los permisos del token.

### Webhook de GitHub

En la configuración de su repositorio u organización, añada un webhook:

- **Payload URL**: `https://redmine.example.com/pull_requests/github/webhook`
- **Content type**: `application/json`
- **Secret**: el secreto del webhook de GitHub de la configuración del plugin
- **Events**: *Pull requests*, además de *Pull request reviews*, *Pull request review comments*, *Pull request review threads*, *Issue comments*, *Check runs*, *Check suites* y *Statuses* para mantener actualizadas las revisiones y las comprobaciones

### Webhook de GitLab

En la configuración de su proyecto, o en la del grupo en GitLab Premium y Ultimate (*Settings » Webhooks*), añada un webhook:

- **URL**: `https://redmine.example.com/pull_requests/gitlab/webhook`
- **Secret token**: el secreto del webhook de GitLab de la configuración del plugin
- **Trigger**: *Merge request events*, además de *Comments* y *Pipeline events* para mantener actualizados los comentarios y los pipelines

Los payloads de los webhooks no incluyen las revisiones, las comprobaciones ni (en GitLab) el autor y el número de commits. Con un token de acceso configurado, el plugin los vuelve a cargar desde la API en una tarea en segundo plano (Rails ActiveJob, que se ejecuta dentro del proceso de Redmine salvo que haya configurado otro adaptador de colas), de modo que las entregas del webhook se responden al instante. La tarea se inicia a los pocos segundos, y las entregas para el mismo pull request que lleguen hasta entonces quedan cubiertas por esa única recarga. Sin token, solo se actualizan al pulsar el botón de actualizar (*Actualizar desde GitHub* / *Actualizar desde GitLab*). Los hilos de revisión sin resolver de GitHub proceden de la API GraphQL y requieren un token.

### Vinculación

Los webhooks mantienen actualizados los pull requests y merge requests vinculados. Las peticiones referenciadas se vinculan cuando un pull request se abre, se edita, se reabre o se marca como listo para revisión, siempre que el proyecto de la petición tenga el módulo activado y [permita el repositorio](#repositorios-permitidos). En GitLab, una edición solo vincula peticiones si cambia el título, la descripción o el estado de borrador; no con pushes, etiquetas, asignaciones ni revisores. Se procesan como máximo 50 referencias por evento. Un vínculo que se elimina a mano no vuelve a añadirse con pushes posteriores. Los nombres de rama como `release/2024-10`, `v2.3.1` o `2024-q3` no vinculan peticiones. Las peticiones también se reconocen por su URL completa, p. ej. `https://redmine.example.com/issues/123`, si coincide con el *Nombre y ruta del servidor* de *Administración » Configuración » General*.

Las palabras clave para la corrección se aplican una sola vez por pull request, cuando llega el evento de fusión. Los cambios de estado provocados por estas palabras clave se registran como realizados por *Anónimo*, igual que hace el propio procesamiento de commits de Redmine con los autores de commits que no puede asociar a un usuario.

## API REST

Requiere *Activar servicio web REST* en *Administración » Configuración » API*. La autenticación y los códigos de estado funcionan como en el resto de la API de Redmine (cabecera `X-Redmine-API-Key`, `.json` o `.xml`). La lectura requiere el permiso *Ver pull requests*; todos los demás endpoints requieren *Administrar pull requests*.

| Método | Ruta | |
| --- | --- | --- |
| `GET` | `/issues/:issue_id/pull_requests.json` | Pull requests vinculados a la petición |
| `GET` | `/issues/:issue_id/pull_requests/:id.json` | Un pull request |
| `POST` | `/issues/:issue_id/pull_requests.json` | Vincula pull requests o merge requests por URL; devuelve `201` con los pull requests vinculados |
| `POST` | `/issues/:issue_id/pull_requests/:id/refresh.json` | Vuelve a cargar desde GitHub/GitLab |
| `DELETE` | `/issues/:issue_id/pull_requests/:id.json` | Desvincula; devuelve `204` |

```sh
curl -X POST https://redmine.example.com/issues/123/pull_requests.json \
  -H "X-Redmine-API-Key: $REDMINE_API_KEY" -H "Content-Type: application/json" \
  -d '{"pull_request": {"urls": ["https://github.com/acme/web/pull/42",
                                 "https://gitlab.com/acme/platform/web/-/merge_requests/7"]}}'
```

`{"pull_request": {"url": "..."}}` vincula una sola URL; se admiten como máximo 20 URL por solicitud. La vinculación es idempotente. Si alguna de las URL no es válida, no está [permitida en el proyecto](#repositorios-permitidos) o no se puede cargar, no se guarda nada y la respuesta es `422` con los motivos, en el idioma del usuario de la API:

```json
{"errors": ["acme/secret no está permitido en este proyecto (Configuración › Pull requests).", "No se pudo cargar acme/web#9999 desde GitHub (404 Not Found)."]}
```

Un pull request tiene este aspecto (abreviado):

```json
{
  "id": 1, "provider": "github", "repository": "acme/web", "number": 42, "reference": "acme/web#42",
  "url": "https://github.com/acme/web/pull/42", "title": "Add OAuth login with GitHub and Google",
  "state": "open", "status": "open", "draft": false,
  "author": {"login": "octocat", "avatar_url": "https://avatars.githubusercontent.com/u/583231"},
  "head_ref": "feature/oauth-login", "base_ref": "main", "head_sha": "6dcb09b5",
  "commits_count": 7, "additions": 1312, "deletions": 48, "changed_files": 23,
  "review_decision": "approved",
  "reviewers": [{"login": "monalisa", "state": "approved", "avatar_url": "..."}],
  "comments_count": 12, "unresolved_threads_count": 2,
  "checks": {"state": "pending", "total": 4, "passed": 3, "failed": 0, "url": "https://github.com/acme/web/pull/42/checks"},
  "opened_on": "2026-10-17T18:30:54Z", "synced_on": "2026-10-19T18:36:19Z",
  "linked_on": "2026-10-19T18:36:19Z", "linked_by": {"id": 5, "name": "Dana Tester"}, "link_source": "manual"
}
```

Los valores desconocidos son `null`, salvo `author`, `merged_by`, `checks` y `linked_by`, que se omiten cuando se desconocen: `merged_by` solo aparece en pull requests fusionados, `checks` en cuanto existen comprobaciones o un pipeline, y `linked_by` en los vínculos creados por un usuario (no por un webhook). `merged_on` y `closed_on` siempre están presentes y son `null` mientras el pull request está abierto.

- `state`: `open`, `merged` o `closed`. `status` distingue además `draft`.
- `review_decision`: `approved`, `changes_requested`, `review_required` o `null`.
- `state` de un revisor: `approved`, `changes_requested`, `commented` o `pending`.
- `checks.state`: `success`, `failure`, `pending` o `neutral`. En GitLab es el estado del pipeline, y `total`, `passed` y `failed` son `null`.
- `link_source`: `manual` (interfaz/API) o `webhook`.

## Desarrollo

Las pruebas E2E inician Redmine y una API simulada de GitHub/GitLab con Docker y se ejecutan con [Playwright](https://playwright.dev):

```sh
cd e2e
npm install
npx playwright install chromium
npm test                            # starts Redmine 7.0, seeds it and runs all tests
REDMINE_IMAGE=redmine:5.1 npm test  # any other Redmine image
npm run screenshots                 # regenerates the images in docs/
npm run stack:down                  # removes the containers
./install-test.sh 6.1               # installs a release archive of HEAD into a fresh redmine:6.1
```

Defina `E2E_SKIP_STACK=1` para reutilizar un stack que ya esté en ejecución y con datos iniciales.

Durante las pruebas, Redmine se ejecuta en http://localhost:3000 (inicie sesión con `admin` / `admin12345`, o con `manager`, `dev` o `reporter` y la contraseña `password123`). Para usar otros puertos, defina `REDMINE_PORT` y `MOCK_API_PORT` junto con `REDMINE_URL` y `MOCK_API_URL`.

## Publicación de versiones

1. Actualice `version` en `init.rb` y añada una sección para ella en `CHANGELOG.md`.
2. Haga commit y, después, cree y suba la etiqueta: `git tag v1.2.3 && git push origin v1.2.3`.

El workflow de publicación ejecuta las pruebas E2E sobre el commit etiquetado, comprueba que la etiqueta coincide con `init.rb`, genera los archivos y publica una release de GitHub con la sección del registro de cambios como notas. Las etiquetas con un sufijo como `v1.3.0-rc.1` se publican como pre-releases y no pasan a ser la última versión.

## Seguridad

Consulte [SECURITY.md](SECURITY.md) para saber cómo informar de vulnerabilidades.

## Licencia

[MIT](LICENSE)

## Créditos

Los iconos son [GitHub Octicons](https://github.com/primer/octicons) (MIT) y el logotipo de GitLab procede de [Simple Icons](https://simpleicons.org) (CC0).
