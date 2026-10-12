import Image from 'next/image';

// One React Native screen, captured on each platform in both appearances from the Expo fixture.
const PHONES = [
  {
    alt: 'A Today screen built from Glassy UI components on iOS 27: glass cards, a segmented control, a switch, checkboxes and a dock over red ribbon artwork.',
    detail: 'The system’s own glass',
    height: 1304,
    name: 'iOS',
    platform: 'ios',
  },
  {
    alt: 'The same Today screen on Android, its glass blurring the ribbon artwork behind it.',
    detail: 'A blur of the screen behind',
    height: 1333,
    name: 'Android',
    platform: 'android',
  },
  {
    alt: 'The same Today screen in a phone-sized browser window, its glass blurred with CSS.',
    detail: 'CSS blur through React Native for Web',
    height: 1304,
    name: 'Web',
    platform: 'web',
  },
] as const;

const THEMES = ['light', 'dark'] as const;

/**
 * The same React Native screen on iOS, Android and the web. Below 900 px the row scrolls
 * sideways, so it takes keyboard focus for the arrow keys to scroll it.
 */
export function MobilePhones() {
  return (
    <div
      aria-label="Screenshots on iOS, Android and the web"
      className="mobile-phones"
      role="region"
      tabIndex={0}
    >
      {PHONES.map((phone) => (
        <figure className="mobile-phone" data-platform={phone.platform} key={phone.platform}>
          <span className="mobile-phone-frame">
            {THEMES.map((theme) => (
              <Image
                alt={phone.alt}
                className="mobile-phone-shot"
                data-theme={theme}
                height={phone.height}
                key={theme}
                sizes="(max-width: 900px) 240px, 300px"
                src={`/previews/mobile/${phone.platform}-${theme}.webp`}
                unoptimized
                width={600}
              />
            ))}
          </span>
          <figcaption>
            <strong>{phone.name}</strong>
            <span>{phone.detail}</span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
