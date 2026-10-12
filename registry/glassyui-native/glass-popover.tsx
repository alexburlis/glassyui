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
import { StyleSheet, Text, View, useWindowDimensions, type ViewProps } from 'react-native';
import { useGlassTheme } from './glass-provider';
import {
  AnchoredContent,
  OverlayTrigger,
  assignRef,
  type OverlayPlacementProps,
  type OverlayTriggerChildProps,
} from './lib/anchored-overlay';
import { wrapPlainText } from './lib/plain-text';
import { GLASS_RADIUS } from './lib/tokens';
import { useControllableState } from './lib/use-controllable-state';

type PopoverContextValue = {
  /** A GlassPopoverAnchor's view, which the popover opens beside instead of its trigger. */
  anchor: View | null;
  open: boolean;
  setAnchor: (node: View | null) => void;
  setOpen: (open: boolean) => void;
  setTrigger: (node: View | null) => void;
  trigger: View | null;
};

const PopoverContext = createContext<PopoverContextValue | null>(null);

function usePopoverContext(component: string) {
  const context = useContext(PopoverContext);

  if (!context) throw new Error(`${component} must be used within GlassPopover`);

  return context;
}

// The web's lg-popover-content: min(22rem, 100vw - 2rem) wide.
const POPOVER_WIDTH = 352;

const POPOVER_GUTTER = 32;

export type GlassPopoverProps = {
  children?: ReactNode;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
};

/** Holds a popover's open state for its trigger and content. */
export function GlassPopover({
  children,
  defaultOpen = false,
  onOpenChange,
  open,
}: GlassPopoverProps) {
  const [isOpen, setOpen] = useControllableState(open, defaultOpen, onOpenChange);
  const [trigger, setTrigger] = useState<View | null>(null);
  const [anchor, setAnchor] = useState<View | null>(null);

  const value = useMemo(
    () => ({ anchor, open: isOpen, setAnchor, setOpen, setTrigger, trigger }),
    [anchor, isOpen, setOpen, trigger],
  );

  return <PopoverContext.Provider value={value}>{children}</PopoverContext.Provider>;
}

export type GlassPopoverTriggerProps = {
  /** One pressable element, such as a GlassButton, that passes its ref to a view. */
  children: ReactElement<OverlayTriggerChildProps>;
};

/** Opens the popover from its one child, such as a GlassButton, and marks that child expanded. */
export function GlassPopoverTrigger({ children }: GlassPopoverTriggerProps) {
  const popover = usePopoverContext('GlassPopoverTrigger');

  return (
    <OverlayTrigger
      onAnchor={popover.setTrigger}
      onOpenChange={popover.setOpen}
      open={popover.open}
    >
      {children}
    </OverlayTrigger>
  );
}

/** Wraps a view for the popover to open beside instead of its trigger. */
export const GlassPopoverAnchor = forwardRef<View, ViewProps>((props, forwardedRef) => {
  const { setAnchor } = usePopoverContext('GlassPopoverAnchor');

  const ref = useCallback(
    (node: View | null) => {
      setAnchor(node);
      assignRef(forwardedRef, node);
    },
    [forwardedRef, setAnchor],
  );

  return <View ref={ref} collapsable={false} {...props} />;
});

GlassPopoverAnchor.displayName = 'GlassPopoverAnchor';

export type GlassPopoverContentProps = Omit<ViewProps, 'children'> &
  OverlayPlacementProps & {
    children?: ReactNode;
  };

/** The open popover: a glass card that grows out of its trigger. Tap outside to close it. */
export const GlassPopoverContent = forwardRef<View, GlassPopoverContentProps>(
  ({ align = 'center', children, style, ...rest }, ref) => {
    const { colors } = useGlassTheme();
    const viewport = useWindowDimensions();
    const { anchor, open, setOpen, trigger } = usePopoverContext('GlassPopoverContent');
    const close = useCallback(() => setOpen(false), [setOpen]);

    return (
      <AnchoredContent
        ref={ref}
        align={align}
        anchor={anchor ?? trigger}
        onClose={close}
        open={open}
        padding={20}
        radius={GLASS_RADIUS.md}
        style={[{ width: Math.min(POPOVER_WIDTH, viewport.width - POPOVER_GUTTER) }, style]}
        {...rest}
      >
        {wrapPlainText(children, (text) => (
          <Text style={[styles.text, { color: colors.foreground }]}>{text}</Text>
        ))}
      </AnchoredContent>
    );
  },
);

GlassPopoverContent.displayName = 'GlassPopoverContent';

const styles = StyleSheet.create({
  text: { fontSize: 14, lineHeight: 20 },
});
