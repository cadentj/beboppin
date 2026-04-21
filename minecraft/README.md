# Minecraft GitHub Pages Demo

This app is published from the `cadentj/beboppin` repository as a GitHub Pages project site:

- Public URL: `https://cadentj.github.io/beboppin/minecraft/`
- Root URL: `https://cadentj.github.io/beboppin/` redirects to the app
- App source: `minecraft/`
- Build output: `minecraft/dist-demo/`

## Local development

```sh
pnpm dev
```

## Production build

```sh
pnpm build:demo
```

The production build is configured for the GitHub Pages subpath `/beboppin/minecraft/`.

## Deployment

GitHub Actions deploys this app on pushes to `main` and on manual workflow dispatch. The workflow builds `minecraft/dist-demo/`, packages it under a `minecraft/` subdirectory for Pages, and publishes that packaged site. The Pages root redirects to `/beboppin/minecraft/`.
