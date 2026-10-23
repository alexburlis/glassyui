/** A components.json for an Expo app; `shadcn init` does not set one up there. */
export const expoComponentsJson = `{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": { "config": "", "css": "", "baseColor": "neutral", "cssVariables": true },
  "aliases": { "components": "@/components", "utils": "@/lib/utils" }
}`;

/** Merge into tsconfig.json when the installed components live at the app root. */
export const expoTsconfigPaths = `{
  "compilerOptions": {
    "paths": { "@/*": ["./*"] }
  }
}`;
