import {
  Children,
  createContext,
  forwardRef,
  isValidElement,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
  type ViewProps,
} from 'react-native';
import { useGlassTheme } from './glass-provider';
import { wrapPlainText } from './lib/plain-text';
import { GLASS_MOTION, type GlassTone } from './lib/tokens';

export type GlassAvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export type GlassAvatarStatus = 'online' | 'away' | 'busy' | 'offline';

export type GlassAvatarProps = Omit<ViewProps, 'children'> & {
  /** Describes the image. Defaults to `name`. */
  alt?: string;
  /** Shown when there is no image or it fails to load. Defaults to the initials of `name`. */
  fallback?: ReactNode;
  /** Names the person. Its initials fill in for a missing image and pick the colour. */
  name?: string;
  size?: GlassAvatarSize;
  /** A bundled image, as `require('./photo.jpg')` gives it. Use `src` for an address. */
  source?: ImageSourcePropType;
  /** The image's address. */
  src?: string;
  /** A presence dot on the corner. */
  status?: GlassAvatarStatus;
};

const SIZE = {
  xs: { diameter: 24, dot: 7 },
  sm: { diameter: 32, dot: 8 },
  md: { diameter: 40, dot: 10 },
  lg: { diameter: 56, dot: 14 },
  xl: { diameter: 80, dot: 18 },
} as const;

// Initials sit on one of these gradients, picked by the name so a person keeps their colour.
const TONES = [
  ['#2d6de9', '#1a4fc7'],
  ['#b93f24', '#882c1a'],
  ['#707075', '#56565b'],
  ['#d0386f', '#a82458'],
  ['#b9540f', '#9c4308'],
  ['#1f8150', '#146c3c'],
  ['#0e7d8b', '#0a6674'],
  ['#747479', '#535359'],
] as const;

// A face without a name is plain gray.
const NAMELESS = ['#747479', '#535359'] as const;

// The face's hairline rim and the light along its top.
const RIM = {
  dark: 'inset 0px 0px 0px 1px rgba(255, 255, 255, 0.18), inset 0px 1px 0px rgba(255, 255, 255, 0.22)',
  light: 'inset 0px 0px 0px 1px rgba(0, 0, 0, 0.1), inset 0px 1px 0px rgba(255, 255, 255, 0.3)',
} as const;

// The "+N" counter is a step brighter than a resting control.
const MORE_FILL = {
  dark: 'rgba(245, 245, 247, 0.14)',
  light: 'rgba(255, 255, 255, 0.95)',
} as const;

const STATUS_TONE = {
  away: 'orange',
  busy: 'red',
  offline: 'neutral',
  online: 'green',
} as const satisfies Record<GlassAvatarStatus, GlassTone>;

// The web cuts the face away around the dot and under the next avatar. React Native has no masks,
// so a ring in the surface colour draws that gap instead.
const GAP = 2;

const EASE_OUT = Easing.bezier(0.32, 0.72, 0, 1);

const GroupSizeContext = createContext<GlassAvatarSize | null>(null);

function initialsOf(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) return '';

  const first = Array.from(words[0])[0] ?? '';
  const last = words.length > 1 ? (Array.from(words[words.length - 1])[0] ?? '') : '';

  return `${first}${last}`.toUpperCase();
}

// The same name always gets the same colour.
function toneOf(name: string) {
  let hash = 0;

  for (const character of name) hash = (hash * 31 + (character.codePointAt(0) ?? 0)) >>> 0;

  return TONES[hash % TONES.length];
}

type FaceProps = {
  fallback: ReactNode;
  source: ImageSourcePropType | undefined;
  tone: readonly [string, string];
};

/** The image once it loads, over the fallback until then or for good if it fails. */
function Face({ fallback, source, tone }: FaceProps) {
  const { preferences } = useGlassTheme();
  const [status, setStatus] = useState<'loading' | 'loaded' | 'failed'>('loading');
  const [arrival] = useState(() => new Animated.Value(0));

  const handleLoad = useCallback(() => {
    setStatus('loaded');

    if (preferences.reduceMotion) {
      arrival.setValue(1);

      return;
    }

    Animated.timing(arrival, {
      duration: 260,
      easing: EASE_OUT,
      toValue: 1,
      useNativeDriver: GLASS_MOTION.nativeDriver,
    }).start();
  }, [arrival, preferences.reduceMotion]);

  const handleError = useCallback(() => setStatus('failed'), []);

  return (
    <>
      {status === 'loaded' ? null : (
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.center,
            {
              backgroundColor: tone[0],
              experimental_backgroundImage: `linear-gradient(145deg, ${tone[0]}, ${tone[1]})`,
            },
          ]}
        >
          {fallback}
        </View>
      )}
      {source && status !== 'failed' ? (
        <Animated.Image
          accessibilityIgnoresInvertColors
          onError={handleError}
          onLoad={handleLoad}
          resizeMode="cover"
          source={source}
          style={[
            StyleSheet.absoluteFill,
            {
              opacity: arrival,
              transform: [
                { scale: arrival.interpolate({ inputRange: [0, 1], outputRange: [1.06, 1] }) },
              ],
            },
          ]}
        />
      ) : null}
    </>
  );
}

/** A round photo that falls back to coloured initials, with an optional presence dot. */
export const GlassAvatar = forwardRef<View, GlassAvatarProps>(
  ({ alt, fallback, name, size = 'md', source, src, status, style, ...rest }, ref) => {
    const { colors, preferences } = useGlassTheme();
    const groupSize = useContext(GroupSizeContext);
    const { diameter, dot } = SIZE[groupSize ?? size];
    const image = useMemo(() => source ?? (src ? { uri: src } : undefined), [source, src]);
    // A new image starts over, showing the fallback until it loads.
    const imageKey = image ? JSON.stringify(image) : 'none';
    const described = [alt ?? name, status].filter(Boolean).join(', ');
    // The dot's centre sits on the circle's edge, at its lower trailing corner.
    const center = diameter * 0.8536;

    const content = wrapPlainText(fallback ?? (name ? initialsOf(name) : null), (text) => (
      <Text style={[styles.initials, { fontSize: diameter * 0.38 }]}>{text}</Text>
    ));

    return (
      <View
        ref={ref}
        accessibilityLabel={described || undefined}
        accessibilityRole={described ? 'image' : undefined}
        accessible={described.length > 0}
        style={[{ height: diameter, width: diameter }, style]}
        {...rest}
      >
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[
            styles.face,
            { backgroundColor: colors.controlSurface, borderRadius: diameter / 2 },
          ]}
        >
          <Face
            key={imageKey}
            fallback={content}
            source={image}
            tone={name ? toneOf(name) : NAMELESS}
          />
          <View
            style={[
              StyleSheet.absoluteFill,
              styles.rim,
              { borderRadius: diameter / 2, boxShadow: RIM[preferences.theme] },
            ]}
          />
        </View>
        {status ? (
          <View
            style={[
              styles.dot,
              {
                backgroundColor: colors.tones[STATUS_TONE[status]],
                borderColor: colors.opaqueSurface,
                borderRadius: dot / 2 + GAP,
                height: dot + GAP * 2,
                start: center - dot / 2 - GAP,
                top: center - dot / 2 - GAP,
                width: dot + GAP * 2,
              },
            ]}
          />
        ) : null}
      </View>
    );
  },
);

GlassAvatar.displayName = 'GlassAvatar';

export type GlassAvatarGroupProps = ViewProps & {
  /** Shows this many avatars, then a "+N" for the rest. */
  max?: number;
  /** Sizes every avatar in the group. */
  size?: GlassAvatarSize;
};

/** Avatars stacked edge to edge, each overlapping the one before it, then a "+N" for the rest. */
export const GlassAvatarGroup = forwardRef<View, GlassAvatarGroupProps>(
  ({ children, max, size = 'md', style, ...rest }, ref) => {
    const { colors, preferences } = useGlassTheme();
    const items = Children.toArray(children);
    const shown = max === undefined ? items : items.slice(0, Math.max(0, max));
    const hidden = items.length - shown.length;
    const { diameter } = SIZE[size];

    // Each avatar wears the gap ring outside its own outline, so the ring takes no room.
    const ring = {
      borderColor: colors.opaqueSurface,
      borderRadius: diameter / 2 + GAP,
      borderWidth: GAP,
      margin: -GAP,
    };

    const overlap = { marginStart: -diameter * 0.2 - GAP };

    return (
      <GroupSizeContext.Provider value={size}>
        <View ref={ref} style={[styles.group, style]} {...rest}>
          {shown.map((child, index) => (
            <View
              key={isValidElement(child) ? child.key : index}
              style={[ring, index > 0 && overlap]}
            >
              {child}
            </View>
          ))}
          {hidden > 0 ? (
            <View
              accessible
              accessibilityLabel={`${hidden} more`}
              accessibilityRole="image"
              style={[ring, shown.length > 0 && overlap]}
            >
              <View
                style={[
                  styles.face,
                  styles.center,
                  {
                    backgroundColor: MORE_FILL[preferences.theme],
                    borderRadius: diameter / 2,
                    height: diameter,
                    width: diameter,
                  },
                ]}
              >
                <Text
                  style={[styles.more, { color: colors.foreground, fontSize: diameter * 0.32 }]}
                >
                  +{hidden}
                </Text>
                <View
                  style={[
                    StyleSheet.absoluteFill,
                    styles.rim,
                    { borderRadius: diameter / 2, boxShadow: RIM[preferences.theme] },
                  ]}
                />
              </View>
            </View>
          ) : null}
        </View>
      </GroupSizeContext.Provider>
    );
  },
);

GlassAvatarGroup.displayName = 'GlassAvatarGroup';

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  dot: { borderWidth: GAP, pointerEvents: 'none', position: 'absolute' },
  face: { height: '100%', overflow: 'hidden', width: '100%' },
  group: { alignItems: 'center', flexDirection: 'row' },
  initials: {
    color: '#ffffff',
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.22)',
    textShadowOffset: { height: 1, width: 0 },
    textShadowRadius: 1,
  },
  more: { fontWeight: '600' },
  rim: { pointerEvents: 'none' },
});
