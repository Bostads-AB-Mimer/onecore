# Keycloak theme (`@onecore/keycloak-theme`)

The `mimer` login theme for the tenant realm (`mimer-contacts`) in Keycloak. It makes
the Keycloak login look like the login on mimer.nu/mina-sidor. Built against
Keycloak **26.3.3**, the version pinned in the ops repo.

## Preview locally

Requires Docker and `jq`.

```sh
pnpm preview      # Keycloak + Mailpit, and a fresh local mimer-contacts realm
pnpm preview:stop
```

- Login: http://localhost:18080/realms/mimer-contacts/account (`198501011234` / `Test1234!`)
- Mail (password reset): http://localhost:18025

Theme caching is off, so edits to templates, texts and CSS show on reload (use a
fresh or incognito window for CSS, the browser caches it).

## How it works

A Keycloak theme is a folder per page type (`login/`, `email/`, `account/`) that
names a **parent**. Every template, stylesheet, image and text is looked up in
this theme first and then in the parent, so the theme only contains what differs
from Keycloak's own `keycloak.v2`.

| File (under `theme/mimer/login/`) | What it does                                                                                                                                                                                                                   |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `theme.properties`                | `parent=keycloak.v2`; adds `css/mimer.css` after the parent's CSS; `darkMode=false` (the parent follows the OS dark mode); `locales=sv` (Swedish only)                                                                         |
| `resources/css/mimer.css`         | Most of the look. PatternFly 5 (Keycloak's UI kit) reads colour and font from `--pf-v5-global--*` variables, so section 1 recolours everything; the rest is layout (header bar, card, fields, buttons)                        |
| `messages/messages_sv.properties` | Texts by key, overriding Keycloak's own Swedish. `loginTitleHtml` is rendered as HTML in the header, which is how the logo replaces the realm name                                                                             |
| `login.ftl`                       | Copy of the parent's with `Mimer:` comments: BankID first, the first-login notice, "Glömt lösenord" below the button, placeholder on the username field                                                                       |
| `login-reset-password.ftl`        | Copy of the parent's, only to add the same placeholder                                                                                                                                                                         |
| `mimer-field.ftl`                 | Our own macro: the parent's text input plus a `placeholder` (the parent's `field.input` has no such parameter). Both templates above use it                                                                                    |
| `resources/js/normalize-login-id.js` | Turns what the tenant types into the canonical username before the form is posted: personnummer to 12 digits, organisationsnummer to 10. Tested in `test/`                                                                  |
| `resources/fonts/`, `resources/img/` | Bison and Graphik (the same files `apps/internal-portal` ships), the mimer.nu logo and the white BankID mark from Mina sidor                                                                                                |

Every other page (set new password, errors) still uses the parent's templates and
only picks up the CSS and texts.

## Packaging and deployment

`META-INF/keycloak-themes.json` plus `theme/` zipped together is a theme JAR,
which Keycloak loads from its `providers` directory. `pnpm build` writes it to
`dist/mimer-theme.jar`; the `Dockerfile` builds the same JAR into a small image,
`ghcr.io/bostads-ab-mimer/onecore/keycloak-theme`, published by CI like the other
apps.

In the cluster that image runs as an **init container** next to Keycloak and
copies the JAR into the providers volume. Installing the theme does nothing by
itself: a realm has to select it (_Realm settings → Themes → Login theme_), so
other realms on the same Keycloak are unaffected. The tenant realm is Swedish
only: _Realm settings → Localization_, internationalization **on**, supported
locales `sv` only, default `sv`. With internationalization off Keycloak uses
English; with more than one locale it shows a language picker.

## Upgrading Keycloak

`login.ftl` and `login-reset-password.ftl` are copies, so a Keycloak upgrade can
change the parent's versions underneath them. After upgrading, diff both against
`keycloak.v2/login/` from the new image and carry the `Mimer:` changes over.
`mimer-field.ftl` calls the parent's `field.group` and `field.errorIcon` macros,
so check their signatures too. Bump the image in `docker-compose.yml` to match.

Graphik's Å ring is taller than its capitals, and Chromium clips it inside inputs
(Å shows as Ă) at PatternFly's default line-height. `mimer.css` works around this
for the input text and, separately, for the placeholder. Check Å after any change
to field font size, padding or line-height.
