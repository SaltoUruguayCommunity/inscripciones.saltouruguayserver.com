# Astro Starter Kit: Basics

```sh
pnpm create astro@latest -- --template basics
```

> 🧑‍🚀 **Seasoned astronaut?** Delete this file. Have fun!

## 🚀 Project Structure

Inside of your Astro project, you'll see the following folders and files:

```text
/
├── public/
│   └── favicon.svg
├── src
│   ├── assets
│   │   └── astro.svg
│   ├── components
│   │   └── Welcome.astro
│   ├── layouts
│   │   └── Layout.astro
│   └── pages
│       └── index.astro
└── package.json
```

To learn more about the folder structure of an Astro project, refer to [our guide on project structure](https://docs.astro.build/en/basics/project-structure/).

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `pnpm install`             | Installs dependencies                            |
| `pnpm dev`             | Starts local dev server at `localhost:4321`      |
| `pnpm build`           | Build your production site to `./dist/`          |
| `pnpm preview`         | Preview your build locally, before deploying     |
| `pnpm astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `pnpm astro -- --help` | Get help using the Astro CLI                     |

## 👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).

## API para aplicaciones

- `GET /eventos/{id}.json`: detalle público `{ success, event }`, campos personalizados, cantidad de inscriptos y cupos restantes. Devuelve 400 para IDs inválidos y 404 si no existe.
- `POST /api/inscriptions/create`: enviar `Authorization: Bearer <access_token>` emitido por OAuth de la web principal con scope `profile` (opcionalmente `email`), y JSON `{ "eventId": 1, "customData": { "nombre_del_campo": "valor" } }`. Se valida mediante `/oauth/userinfo` de `SUS_OAUTH_ISSUER` y se sincroniza el usuario local. Sin Authorization se conserva la sesión web. Token inválido: 401; fallo de validación remoto: 503.

### Inscribir desde mobile

`POST /eventos/{id}/inscripciones.json` con `Authorization: Bearer <access_token>` y `Content-Type: application/json`. Body: `{ "customData": { "nombre_del_campo": "valor" } }` (usar `{}` si no hay campos). El evento se toma exclusivamente de la URL; no hace falta enviar `eventId`. Devuelve 201 con `{ success: true, inscription }`. La ruta exige Bearer; la ruta anterior se conserva para la web. Acepta tokens OAuth válidos con scope `profile`; no restringe por client_id.

`GET /eventos/{id}/inscripciones.json` exige Bearer y devuelve `{ success: true, inscription: null }` si el usuario no está inscrito, o su comprobante (`id`, `eventId`, `status`, `customData`, `createdAt`). No devuelve datos de otros usuarios ni notas administrativas; la respuesta usa `Cache-Control: private, no-store`.

La creación valida estado abierto, campos obligatorios, email, URL y opciones. El límite de cupos y la inserción se resuelven en una sentencia SQLite; duplicados/cierre/falta de cupo devuelven 409.

### Requisitos personalizados del evento

`GET /eventos/{id}.json` acepta Bearer de la web principal o sesión web. Incluye `event.registration`: `canRegister`, `blockedReason`, `requiresDiscordLink`, `requiresDiscordMembership` y `discordStatus`. Si falta Discord, devuelve `discord_link_required`; si está vinculado pero no pertenece al servidor, `discord_membership_required`. Si no se pudo comprobar, devuelve `discord_verification_unavailable` y bloquea la inscripción. La validación se repite en POST. También informa los bloqueos por sesión, inscripción existente, evento cerrado o cupo agotado.

Sin autenticar conserva el detalle público y devuelve `authentication_required`. Un Bearer inválido devuelve 401, sin degradar a anónimo. Las respuestas personalizadas usan `Cache-Control: private, no-store` y `Vary: Authorization, Cookie`.
