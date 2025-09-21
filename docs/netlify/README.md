# Bodega Netlify API

Upload API endpoint for GemStone IV Bodega shop data processing.

## Endpoints

- **POST** `/netlify/functions/upload` - Upload shop data and trigger GitHub workflow

## Environment Variables

- `GITHUB_TOKEN` - GitHub personal access token with `repo` and `gist` permissions

## Deployment

This repository is auto-deployed to Netlify. The function will be available at:
`https://your-site.netlify.app/.netlify/functions/upload`

## Local Development

```bash
npm install
npm run dev
```