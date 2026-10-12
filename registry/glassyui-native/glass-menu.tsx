import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { StyleSheet, Text, View, type TextProps, type ViewProps } from 'react-native';
import { useGlassTheme } from './glass-provider';
import {
  AnchoredContent,
  OverlayItem,
  OverlayLabel,
  OverlaySeparator,
  OverlayTrigger,
  type OverlayItemProps,
  type OverlayPlacementProps,
  type OverlayTriggerChildProps,
} from './lib/anchored-overlay';
import { GlassIcon } from './lib/icons';
import { useControllableState } from './lib/use-controllable-state';

type MenuContextValue = {
  anchor: View | null;
  open: boolean;
  setAnchor: (node: View | null) => void;
  setOpen: (open: boolean) => void;
};

const MenuContext = createContext<MenuContextValue | null>(null);

function useMenuContext(component: string) {
  const context = useContext(MenuContext);

  if (!context) throw new Error(`${component} must be used within GlassMenu`);

  return context;
}

type RadioGroupContextValue = {
  onValueChange?: (value: string) => void;
  value?: string;
};

const RadioGroupContext = createContext<RadioGroupContextValue | null>(null);

function useRadioGroupContext() {
  const context = useContext(RadioGroupContext);

  if (!context) throw new Error('GlassMenuRadioItem must be used within GlassMenuRadioGroup');

  return context;
}

// The web's lg-menu-content: 14rem wide at least, with 1.125rem corners.
const MENU_MIN_WIDTH = 224;

const MENU_RADIUS = 18;

export type GlassMenuProps = {
  children?: ReactNode;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
};

/** Holds a menu's open state for its trigger and content. */
export function GlassMenu({ children, defaultOpen = false, onOpenChange, open }: GlassMenuProps) {
  const [isOpen, setOpen] = useControllableState(open, defaultOpen, onOpenChange);
  const [anchor, setAnchor] = useState<View | null>(null);

  const value = useMemo(
    () => ({ anchor, open: isOpen, setAnchor, setOpen }),
    [anchor, isOpen, setOpen],
  );

  return <MenuContext.Provider value={value}>{children}</MenuContext.Provider>;
}

export type GlassMenuTriggerProps = {
  /** One pressable element, such as a GlassButton, that passes its ref to a view. */
  children: ReactElement<OverlayTriggerChildProps>;
};

/** Opens the menu from its one child, such as a GlassButton, and marks that child expanded. */
export function GlassMenuTrigger({ children }: GlassMenuTriggerProps) {
  const menu = useMenuContext('GlassMenuTrigger');

  return (
    <OverlayTrigger onAnchor={menu.setAnchor} onOpenChange={menu.setOpen} open={menu.open}>
      {children}
    </OverlayTrigger>
  );
}

export type GlassMenuContentProps = Omit<ViewProps, 'children'> &
  OverlayPlacementProps & {
    children?: ReactNode;
  };

/** The open menu: a glass slab that grows out of its trigger and scrolls when it runs out of room. */
export const GlassMenuContent = forwardRef<View, GlassMenuContentProps>(
  ({ align = 'center', children, ...rest }, ref) => {
    const { anchor, open, setOpen } = useMenuContext('GlassMenuContent');
    const close = useCallback(() => setOpen(false), [setOpen]);

    return (
      <AnchoredContent
        ref={ref}
        accessibilityRole="menu"
        align={align}
        anchor={anchor}
        minWidth={MENU_MIN_WIDTH}
        onClose={close}
        open={open}
        padding={6}
        radius={MENU_RADIUS}
        {...rest}
      >
        {children}
      </AnchoredContent>
    );
  },
);

GlassMenuContent.displayName = 'GlassMenuContent';

export type GlassMenuSelectEvent = {
  defaultPrevented: boolean;
  /** Keeps the menu open after this selection. */
  preventDefault: () => void;
};

function createSelectEvent(): GlassMenuSelectEvent {
  const event = {
    defaultPrevented: false,
    preventDefault: () => {
      event.defaultPrevented = true;
    },
  };

  return event;
}

export type GlassMenuItemProps = Omit<OverlayItemProps, 'indicator' | 'onPress' | 'textStyle'> & {
  /** Runs when the row is chosen. The menu then closes unless the handler prevents it. */
  onSelect?: (event: GlassMenuSelectEvent) => void;
};

type MenuRowProps = GlassMenuItemProps & {
  indicator?: ReactNode;
};

const MenuRow = forwardRef<View, MenuRowProps>(({ onSelect, ...rest }, ref) => {
  const { setOpen } = useMenuContext('GlassMenuItem');

  const handlePress = useCallback(() => {
    const event = createSelectEvent();

    onSelect?.(event);

    if (!event.defaultPrevented) setOpen(false);
  }, [onSelect, setOpen]);

  return <OverlayItem ref={ref} onPress={handlePress} {...rest} />;
});

MenuRow.displayName = 'MenuRow';

/** A menu row that runs `onSelect` and closes the menu. */
export const GlassMenuItem = forwardRef<View, GlassMenuItemProps>((props, ref) => (
  <MenuRow ref={ref} {...props} />
));

GlassMenuItem.displayName = 'GlassMenuItem';

export type GlassMenuCheckboxItemProps = Omit<GlassMenuItemProps, 'inset' | 'tone'> & {
  checked?: boolean | 'indeterminate';
  onCheckedChange?: (checked: boolean) => void;
};

/** A menu row that toggles a setting and shows a check while it is on. */
export const GlassMenuCheckboxItem = forwardRef<View, GlassMenuCheckboxItemProps>(
  ({ checked = false, onCheckedChange, onSelect, ...rest }, ref) => {
    const { colors } = useGlassTheme();
    const mixed = checked === 'indeterminate';

    const handleSelect = useCallback(
      (event: GlassMenuSelectEvent) => {
        onSelect?.(event);
        onCheckedChange?.(mixed ? true : !checked);
      },
      [checked, mixed, onCheckedChange, onSelect],
    );

    return (
      <MenuRow
        ref={ref}
        accessibilityState={{ checked: mixed ? 'mixed' : checked }}
        indicator={
          checked ? (
            <GlassIcon color={colors.foreground} name={mixed ? 'dash' : 'check'} size={16} />
          ) : null
        }
        inset
        onSelect={handleSelect}
        {...rest}
      />
    );
  },
);

GlassMenuCheckboxItem.displayName = 'GlassMenuCheckboxItem';

export type GlassMenuRadioGroupProps = ViewProps & {
  onValueChange?: (value: string) => void;
  value?: string;
};

/** Groups radio rows; the row whose value matches `value` shows a dot. */
export const GlassMenuRadioGroup = forwardRef<View, GlassMenuRadioGroupProps>(
  ({ onValueChange, value, ...rest }, ref) => {
    const group = useMemo(() => ({ onValueChange, value }), [onValueChange, value]);

    return (
      <RadioGroupContext.Provider value={group}>
        <View ref={ref} accessibilityRole="radiogroup" {...rest} />
      </RadioGroupContext.Provider>
    );
  },
);

GlassMenuRadioGroup.displayName = 'GlassMenuRadioGroup';

export type GlassMenuRadioItemProps = Omit<GlassMenuItemProps, 'inset' | 'tone'> & {
  value: string;
};

/** A menu row that chooses one value from its radio group. */
export const GlassMenuRadioItem = forwardRef<View, GlassMenuRadioItemProps>(
  ({ onSelect, value, ...rest }, ref) => {
    const { colors } = useGlassTheme();
    const group = useRadioGroupContext();
    const { onValueChange } = group;
    const checked = group.value === value;

    const handleSelect = useCallback(
      (event: GlassMenuSelectEvent) => {
        onSelect?.(event);
        onValueChange?.(value);
      },
      [onSelect, onValueChange, value],
    );

    return (
      <MenuRow
        ref={ref}
        accessibilityState={{ checked }}
        indicator={
          checked ? <View style={[styles.dot, { backgroundColor: colors.foreground }]} /> : null
        }
        inset
        onSelect={handleSelect}
        {...rest}
      />
    );
  },
);

GlassMenuRadioItem.displayName = 'GlassMenuRadioItem';

/** A small muted heading over a group of menu rows. */
export const GlassMenuLabel = forwardRef<Text, TextProps>((props, ref) => (
  <OverlayLabel ref={ref} {...props} />
));

GlassMenuLabel.displayName = 'GlassMenuLabel';

/** A hairline between groups of menu rows. */
export const GlassMenuSeparator = forwardRef<View, ViewProps>((props, ref) => (
  <OverlaySeparator ref={ref} {...props} />
));

GlassMenuSeparator.displayName = 'GlassMenuSeparator';

/** Groups related menu rows. */
export const GlassMenuGroup = forwardRef<View, ViewProps>((props, ref) => (
  <View ref={ref} {...props} />
));

GlassMenuGroup.displayName = 'GlassMenuGroup';

/** Trailing muted text on a menu row, such as a keyboard shortcut. */
export const GlassMenuShortcut = forwardRef<Text, TextProps>(({ style, ...rest }, ref) => {
  const { colors } = useGlassTheme();

  return (
    <Text ref={ref} style={[styles.shortcut, { color: colors.mutedForeground }, style]} {...rest} />
  );
});

GlassMenuShortcut.displayName = 'GlassMenuShortcut';

// The web's lg-menu-indicator dot and lg-menu-shortcut.
const styles = StyleSheet.create({
  dot: { borderRadius: 3.25, height: 6.5, width: 6.5 },
  shortcut: { fontSize: 12, letterSpacing: 0.72, marginStart: 'auto', paddingStart: 24 },
});
