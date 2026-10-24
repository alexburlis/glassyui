/** The people who write the blog. A post names one by `author`, which defaults to Alex Burlis. */
export type Author = {
  id: string;
  name: string;
  role: string;
  /** Two sentences, only facts the site already states. */
  bio: string;
  /** A 512 by 512 square photo in public/. */
  avatar: string;
  /** A 640 by 800 cut-out on a transparent background in public/. */
  portrait: string;
  /** Verified profiles only. */
  sameAs: readonly string[];
};

export const DEFAULT_AUTHOR_ID = 'alex-burlis';

const AUTHORS = [
  {
    id: DEFAULT_AUTHOR_ID,
    name: 'Alex Burlis',
    role: 'Founder of Glassy UI',
    bio: 'Alex Burlis founded Glassy UI, a library of free React glass components with React Native versions for iOS and Android. Alex builds the components, which install with shadcn as source you own.',
    avatar: '/authors/alex-burlis-avatar.jpg',
    portrait: '/authors/alex-burlis-developer.webp',
    sameAs: ['https://x.com/AlexBurlis', 'https://github.com/alexburlis'],
  },
] satisfies Author[];

/** The author with this id; an unknown id fails the build rather than falling back. */
export function getAuthor(id: string): Author {
  const author = AUTHORS.find((candidate) => candidate.id === id);

  if (!author)
    throw new Error(`Unknown blog author "${id}". Add the person to src/lib/authors.ts.`);

  return author;
}
