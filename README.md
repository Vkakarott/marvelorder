# Tela Temporal

Tela Temporal is a Portuguese-language timeline for exploring Marvel films and series and tracking watched titles.

## Local development

Use Node.js 24.19.0 and npm:

```sh
nvm use
npm ci
npm run dev
```

The development server prints its local URL. Run `npm run build` to generate the static site. For deployment, set `PUBLIC_SITE_URL` to the public site origin; Netlify's `URL` environment variable is used when available.

## Project origin

This fork is based on [ThatGuySam/marvelorder](https://github.com/ThatGuySam/marvelorder). The original project provided the starting code and data. Tela Temporal has independent branding and is not affiliated with Marvel.

Film and series artwork and metadata retain their respective owners and sources. The checked-in data supports offline builds; synchronization scripts are separate from the render path.
