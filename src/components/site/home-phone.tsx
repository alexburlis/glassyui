import Image from 'next/image';

// The Expo fixture's Today screen, captured on iOS in each appearance. The page shows the one
// that matches its theme.
const SCREENS = [
  { src: '/previews/mobile/ios-light.webp', theme: 'light' },
  { src: '/previews/mobile/ios-dark.webp', theme: 'dark' },
] as const;

/**
 * The React Native components on iOS, in a phone. It stands beside the features the home page's
 * keynote shows, where the keynote stands still: under reduced motion and without JavaScript.
 */
export function HomePhone() {
  return (
    <figure className="home-phone">
      <span aria-hidden className="home-phone-keys" />
      <span className="home-phone-glass">
        <span className="home-phone-screen">
          {SCREENS.map((screen) => (
            <Image
              key={screen.theme}
              alt="A Today screen built from Glassy UI's React Native components on iOS: glass cards, a segmented control, a switch, checkboxes and a dock over red ribbon artwork."
              className="home-phone-shot"
              data-theme={screen.theme}
              height={1304}
              src={screen.src}
              unoptimized
              width={600}
            />
          ))}
          <span aria-hidden className="home-phone-island" />
        </span>
      </span>
    </figure>
  );
}
