import {
  componentCategories,
  componentDocs,
  glassThemeRoot,
  initializeShadcn,
} from '@/components/docs/component-docs-data';
import { expoComponentsJson, expoTsconfigPaths } from '@/components/docs/expo-setup';
import { componentMarkdown } from '@/lib/component-markdown';
import { installCommand } from '@/lib/install-command';
import { SITE_URL } from '@/lib/site-links';
import nativeRegistry from '../../../registry-native.json';

export const dynamic = 'force-static';

/** Every component's page as markdown in one file, for a model that wants the whole library. */
export function GET() {
  const parts = [
    '# Glassy UI',
    `> Glassy UI components for React, installed with the shadcn CLI as source you own. ${componentDocs.length} components. ${SITE_URL}`,
    '## Set up',
    `Use React 19+ and Tailwind CSS 4+. Initialise shadcn once if the app has no \`components.json\`:\n\n\`\`\`bash\n${initializeShadcn}\n\`\`\`\n\nGlassy UI is in the shadcn registry directory, so \`@glassyui\` items install with no registry mapping:\n\n\`\`\`bash\n${installCommand(['glass-button'], 'react')}\n\`\`\`\n\nComponent pages offer npm, pnpm, modern Yarn and bun commands, plus Manual installation with every required file.\n\nSet \`data-lg-theme\` on the app root: "light" for a light app, "dark" for a dark app. Keep it in sync with your app theme. The provider is optional; match its \`defaultTheme\` to the app’s initial theme.\n\n\`\`\`tsx\n${glassThemeRoot}\n\`\`\``,
    '## Expo',
    `React Native versions of ${nativeRegistry.items.length} items install into Expo apps with the same names and React Native props. Shared controls support Expo SDK 55+; Picker, Swipe Row and Card Stack require SDK 57. \`shadcn init\` does not set up Expo apps. Keep an existing \`components.json\`, or add this one at the app root; keep \`cssVariables\` enabled:\n\n\`\`\`json\n${expoComponentsJson}\n\`\`\`\n\nMatch the \`@/\` alias in \`tsconfig.json\`. Keep an existing mapping or merge this one for components at the app root; use \`./src/*\` when they live in \`src\`:\n\n\`\`\`json\n${expoTsconfigPaths}\n\`\`\`\n\nAdd items by their \`@glassyui-native\` names, which need no registry mapping, and match their packages to the SDK:\n\n\`\`\`bash\n${installCommand(['glass-button'], 'react-native')}\n\`\`\`\n\nManual installation uses \`npx expo install\` for the listed packages and copies every file from the item's payload. Rebuild a development build after adding native packages.\n\nItems: ${nativeRegistry.items.map((item) => item.name).join(', ')}. Guide: ${SITE_URL}/guides/expo`,
    '## shadcn theme',
    `Already using stock shadcn/ui components? One command gives them the Glassy UI look. It writes CSS only, tinted from your own palette, and changes no component file:\n\n\`\`\`bash\npnpm dlx shadcn@4.14.1 add @glassyui/glassy-theme\n\`\`\`\n\nTo turn them into Glassy UI's own components instead, with Glassy UI's look and sizes and, on buttons, cards, alerts, tabs and floats, a lens measured for each element, install the drop-in set for the app's style over its own files (\`glassy-ui-new-york\` for Radix, \`glassy-ui-base-nova\` for Base UI). Imports stay the same; commit first, because \`--overwrite\` replaces those files:\n\n\`\`\`bash\npnpm dlx shadcn@4.14.1 add @glassyui/glassy-ui-new-york --overwrite\n\`\`\`\n\nGuide: ${SITE_URL}/guides/shadcn-theme`,
  ];

  for (const category of componentCategories) {
    for (const component of componentDocs.filter((doc) => doc.category === category)) {
      parts.push(componentMarkdown(component));
    }
  }

  return new Response(`${parts.join('\n\n')}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
