import nativeRegistry from '../../registry-native.json';
import type { ComponentApiPart } from '@/components/docs/component-docs-data';

type NativeComponentDetail = {
  id: string;
  api: ComponentApiPart[];
  types?: string[];
  requires?: string;
  accessibility?: string;
};

export const nativeComponentDocs: NativeComponentDetail[] = [
  {
    id: 'glass-picker',
    api: [
      {
        name: 'GlassPicker',
        description: 'The platform picker on a glass surface; generic over T extends string.',
        props: [
          {
            name: 'label',
            type: 'string',
            default: '—',
            description: 'Visible label and accessible name.',
            required: true,
          },
          {
            name: 'options',
            type: 'readonly { label: string; value: T }[]',
            default: '—',
            description: 'The choices; each value must be unique.',
            required: true,
          },
          {
            name: 'value / onValueChange',
            type: 'T / (value: T) => void',
            default: '—',
            description:
              'The selected value and its change handler; value must match an option, or the picker throws.',
            required: true,
          },
          {
            name: 'appearance',
            type: "'menu' | 'wheel'",
            default: "'menu'",
            description:
              'wheel shows an inline wheel on iOS; Android and the web always use a dropdown.',
          },
          {
            name: 'disabled',
            type: 'boolean',
            default: 'false',
            description: 'Prevents selection changes.',
          },
          {
            name: 'style',
            type: 'StyleProp<ViewStyle>',
            default: '—',
            description: 'Applies to the glass surface.',
          },
          {
            name: 'testID',
            type: 'string',
            default: '—',
            description: 'Passed to the native picker, or as data-testid on the web select.',
          },
        ],
      },
    ],
    types: ['GlassPickerProps'],
  },
  {
    id: 'glass-swipe-row',
    api: [
      {
        name: 'GlassSwipeRow',
        description:
          'A glass row with an Actions button; swiping or the button reveals the actions.',
        props: [
          {
            name: 'children',
            type: 'ReactNode',
            default: '—',
            description: 'The row content.',
            required: true,
          },
          {
            name: 'label',
            type: 'string',
            default: '—',
            description: "Names the row in the Actions button's accessible name.",
            required: true,
          },
          {
            name: 'actions',
            type: 'readonly GlassSwipeAction[]',
            default: '—',
            description:
              'Revealed buttons, each { id, label, onPress, destructive? }; an empty array turns swiping off.',
            required: true,
          },
          {
            name: 'haptics',
            type: 'boolean',
            default: 'true',
            description: 'Plays a selection haptic when the actions open, on iOS and Android.',
          },
          {
            name: 'style',
            type: 'StyleProp<ViewStyle>',
            default: '—',
            description: 'Applies to the outer view.',
          },
          {
            name: 'testID',
            type: 'string',
            default: '—',
            description: 'Set on the outer view.',
          },
        ],
      },
    ],
    types: ['GlassSwipeRowProps', 'GlassSwipeAction'],
    requires:
      'GestureHandlerRootView from react-native-gesture-handler around your app, and around the contents of any native Modal.',
    accessibility:
      'Closed actions are hidden from assistive technology, and the Actions button opens them without a swipe.',
  },
  {
    id: 'glass-card-stack',
    api: [
      {
        name: 'GlassCardStack',
        description:
          'A controlled deck, generic over T extends { id: string }, with a position count between Previous and Next.',
        props: [
          {
            name: 'items',
            type: 'readonly T[]',
            default: '—',
            description: 'The cards in order; each id must be unique and stable.',
            required: true,
          },
          {
            name: 'activeIndex / onIndexChange',
            type: 'number / (index: number) => void',
            default: '—',
            description: 'The current card, clamped to the items, and its change handler.',
            required: true,
          },
          {
            name: 'renderCard',
            type: '(item: T, index: number) => ReactNode',
            default: '—',
            description: 'Card contents; only the previous, current and next two cards render.',
            required: true,
          },
          {
            name: 'label',
            type: 'string',
            default: '—',
            description: "Names the deck in the Previous and Next buttons' accessible names.",
            required: true,
          },
          {
            name: 'height',
            type: 'number',
            default: '220',
            description: 'Card height in points; the deck adds 24 for the stacked edges.',
          },
          {
            name: 'haptics',
            type: 'boolean',
            default: 'true',
            description: 'Plays a selection haptic on each card change, on iOS and Android.',
          },
          {
            name: 'style',
            type: 'StyleProp<ViewStyle>',
            default: '—',
            description: 'Applies to the outer view.',
          },
          {
            name: 'testID',
            type: 'string',
            default: '—',
            description: 'Set on the swipeable deck, not the outer view.',
          },
        ],
      },
    ],
    types: ['GlassCardStackProps'],
    requires: 'GestureHandlerRootView from react-native-gesture-handler around your app.',
    accessibility:
      'Only the current card is exposed and takes input; Previous, Next and a polite live position count give accessible navigation.',
  },
];

export function getNativeComponentDoc(id: string) {
  const detail = nativeComponentDocs.find((component) => component.id === id);

  if (!detail) return null;
  const item = nativeRegistry.items.find((component) => component.name === id);

  if (!item) throw new Error(`Missing native registry item: ${id}`);

  return { ...detail, item };
}
