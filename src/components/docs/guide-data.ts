export const guides = [
  {
    slug: 'shadcn',
    title: 'Add Glassy UI to a React app with shadcn',
    description:
      'Install a glass component, reproduce a complete demo, and customize the source in your own React app.',
  },
  {
    slug: 'shadcn-theme',
    title: 'Make a shadcn/ui app glassy with one command',
    description:
      'Install the Glassy UI theme for shadcn/ui: the components you already use turn to lit, tinted glass in your own colours, with no code changes.',
  },
  {
    slug: 'expo',
    title: 'Add Glassy UI to an Expo app',
    description:
      'Install React Native glass components with shadcn, see how each platform draws them, and give Android a backdrop to blur.',
  },
  {
    slug: 'laptop-mockup',
    title: 'Build a laptop mockup in React',
    description:
      'Use Glass Laptop for a CSS 3D React mockup. Add a screenshot or live screen, animate the lid, and choose black or silver.',
  },
  {
    slug: 'glass-accessibility',
    title: 'Use glass effects without losing readability',
    description:
      'Choose the right glass effect, understand the browser requirements, and preserve motion and transparency preferences.',
  },
] as const;

export function getGuide(slug: string) {
  return guides.find((guide) => guide.slug === slug);
}
