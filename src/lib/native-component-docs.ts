import nativeRegistry from '../../registry-native.json';

export const nativeComponentDocs = [
  {
    id: 'glass-picker',
    notes: [
      'The picker uses SwiftUI on iOS, Jetpack Compose on Android, and a labelled browser select on the web. The wrapper uses GlassSurface.',
      'The wheel appearance is available on iOS. Android and the web use their standard dropdown.',
      'Keep value controlled and matched to one option. Each option needs a unique value.',
    ],
    api: [
      { prop: 'label', type: 'string', description: 'Visible and accessible field label.' },
      {
        prop: 'options',
        type: '{ label: string; value: string }[]',
        description: 'The available choices.',
      },
      {
        prop: 'value / onValueChange',
        type: 'string / (value: string) => void',
        description: 'The selected value and its change handler.',
      },
      { prop: 'appearance', type: "'menu' | 'wheel'", description: 'Defaults to menu.' },
      { prop: 'disabled', type: 'boolean', description: 'Prevents selection changes.' },
    ],
  },
  {
    id: 'glass-swipe-row',
    notes: [
      'Swipe left to reveal actions. The action button provides the same choices without a swipe. Swiping never invokes an action by itself.',
      'Wrap the app in GestureHandlerRootView, above GlassProvider. In a native Modal, wrap its contents too.',
      'Reduce Motion removes spring settling. Selection haptics run on iOS and Android when the action panel opens; haptics={false} disables them.',
    ],
    api: [
      { prop: 'label', type: 'string', description: 'Names the row in the action button.' },
      { prop: 'children', type: 'ReactNode', description: 'The row content.' },
      {
        prop: 'actions',
        type: 'GlassSwipeAction[]',
        description: 'Each action has id, label, onPress, and optional destructive.',
      },
      { prop: 'haptics', type: 'boolean', description: 'Defaults to true on native platforms.' },
    ],
  },
  {
    id: 'glass-card-stack',
    notes: [
      'Drag left for the next card or right for the previous card. A short drag returns to the current card. Release velocity affects spring settling.',
      'Wrap the app in GestureHandlerRootView, above GlassProvider. Vertical drags remain available to the parent scroll view.',
      'Keep activeIndex controlled. Cards need unique, stable ids. Only the current card accepts input; Previous and Next provide accessible navigation.',
      'Reduce Motion keeps selection and navigation but removes drag animation, tilt, and spring travel. Selection haptics run on native platforms unless disabled.',
    ],
    api: [
      {
        prop: 'items',
        type: 'T[] where T extends { id: string }',
        description: 'The ordered cards.',
      },
      {
        prop: 'activeIndex / onIndexChange',
        type: 'number / (index: number) => void',
        description: 'The selected card and its change handler.',
      },
      {
        prop: 'renderCard',
        type: '(item: T, index: number) => ReactNode',
        description: 'The contents of each card.',
      },
      { prop: 'label', type: 'string', description: 'Names the deck in its navigation controls.' },
      { prop: 'height', type: 'number', description: 'Card height in points; defaults to 220.' },
      { prop: 'haptics', type: 'boolean', description: 'Defaults to true on native platforms.' },
    ],
  },
];

export function getNativeComponentDoc(id: string) {
  const detail = nativeComponentDocs.find((component) => component.id === id);

  if (!detail) return null;
  const item = nativeRegistry.items.find((component) => component.name === id);

  if (!item) throw new Error(`Missing native registry item: ${id}`);

  return { ...detail, item };
}
