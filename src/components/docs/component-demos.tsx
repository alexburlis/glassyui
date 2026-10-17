'use client';

import Link from 'next/link';
import {
  createContext,
  useCallback,
  useContext,
  useId,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';
import {
  GlassAccordion,
  GlassAccordionContent,
  GlassAccordionItem,
  GlassAccordionTrigger,
  GlassAlert,
  GlassAvatar,
  GlassAvatarGroup,
  GlassBadge,
  GlassBreadcrumb,
  GlassBreadcrumbEllipsis,
  GlassBreadcrumbItem,
  GlassBreadcrumbLink,
  GlassBreadcrumbPage,
  GlassButton,
  GlassCheckbox,
  GlassCommand,
  GlassCommandDialog,
  GlassCommandEmpty,
  GlassCommandGroup,
  GlassCommandInput,
  GlassCommandItem,
  GlassCommandList,
  GlassCommandSeparator,
  GlassCommandShortcut,
  GlassDialog,
  GlassDialogContent,
  GlassDialogDescription,
  GlassDialogTitle,
  GlassDialogTrigger,
  GlassInput,
  GlassHeader,
  GlassKbd,
  GlassKbdGroup,
  GlassMenu,
  GlassMenuCheckboxItem,
  GlassMenuContent,
  GlassMenuItem,
  GlassMenuLabel,
  GlassMenuRadioGroup,
  GlassMenuRadioItem,
  GlassMenuSeparator,
  GlassMenuShortcut,
  GlassMenuTrigger,
  GlassPagination,
  GlassPanel,
  GlassPopover,
  GlassPopoverContent,
  GlassPopoverTrigger,
  GlassProgress,
  GlassRadioGroup,
  GlassRadioGroupItem,
  GlassScrollArea,
  GlassSegmentedControl,
  GlassSegmentedControlItem,
  GlassSelect,
  GlassSelectContent,
  GlassSelectGroup,
  GlassSelectItem,
  GlassSelectLabel,
  GlassSelectSeparator,
  GlassSelectTrigger,
  GlassSelectValue,
  GlassSheet,
  GlassSheetContent,
  GlassSheetDescription,
  GlassSheetTitle,
  GlassSheetTrigger,
  GlassSkeleton,
  GlassSlider,
  GlassSpinner,
  GlassSurface,
  GlassSwitch,
  GlassTabs,
  GlassTabsContent,
  GlassTabsList,
  GlassTabsTrigger,
  GlassTextarea,
  GlassToast,
  GlassToastClose,
  GlassToastDescription,
  GlassToastProvider,
  GlassToastTitle,
  GlassToastViewport,
  GlassTooltip,
  GlassTooltipContent,
  GlassTooltipProvider,
  GlassTooltipTrigger,
  usePreferences,
  type GlassBadgeTone,
} from '@/components/liquid';
import { DockExample } from '@/components/examples/dock-example';
import { LensExample } from '@/components/examples/lens-example';
import { SceneExample } from '@/components/examples/scene-example';
import { SpeakerGlyph } from '@/components/site/glyphs';
import { LaptopShowcase } from '@/components/site/laptop-showcase';
import { PhoneDuoShowcase } from '@/components/site/phone-duo-showcase';

type ReleaseFeedbackContextValue = {
  announce: (message: string) => void;
};

const ReleaseFeedbackContext = createContext<ReleaseFeedbackContextValue | null>(null);

/**
 * A demo in a gallery card is a picture of the component, not something that just happened to the
 * page. Inside one, messages that would interrupt a screen reader are notes instead.
 */
export const QuietDemos = createContext(false);

const ignoreFeedback = () => {};

export function ReleaseFeedbackProvider({ children }: { children: ReactNode }) {
  const [feedback, setFeedback] = useState({
    message: 'Demos ready.',
    sequence: 0,
  });

  const announce = useCallback((message: string) => {
    setFeedback((current) => ({
      message,
      sequence: current.sequence + 1,
    }));
  }, []);

  return (
    <ReleaseFeedbackContext.Provider value={{ announce }}>
      {children}
      <p
        className="docs-release-feedback"
        role="status"
        aria-live="polite"
        aria-label="Release feedback"
      >
        {feedback.message} Update {feedback.sequence}.
      </p>
    </ReleaseFeedbackContext.Provider>
  );
}

function useReleaseFeedback() {
  return useContext(ReleaseFeedbackContext)?.announce ?? ignoreFeedback;
}

function ProviderDemo() {
  const { setPreferences } = usePreferences();
  const announce = useReleaseFeedback();

  const toggleTheme = () => {
    const currentTheme =
      document.documentElement.getAttribute('data-lg-theme') === 'light' ? 'light' : 'dark';

    const nextTheme = currentTheme === 'light' ? 'dark' : 'light';

    setPreferences({ theme: nextTheme });
    announce(`Theme changed to ${nextTheme}.`);
  };

  return <GlassButton onClick={toggleTheme}>Toggle theme</GlassButton>;
}

function SurfaceDemo() {
  const [emphasized, setEmphasized] = useState(false);
  const announce = useReleaseFeedback();

  const toggleEmphasis = () => {
    const next = !emphasized;

    setEmphasized(next);
    announce(`Surface emphasis ${next ? 'enabled' : 'disabled'}.`);
  };

  return (
    <GlassSurface
      className="cpreview-surface"
      interactive
      preset={emphasized ? 'showcase' : 'standard'}
      refraction={emphasized ? 'strong' : 'soft'}
      refractionBackground={<span className="cpreview-refraction-backdrop" />}
    >
      <GlassButton
        aria-label="Toggle surface emphasis"
        aria-pressed={emphasized}
        onClick={toggleEmphasis}
        size="sm"
        variant="soft"
      >
        Toggle emphasis
      </GlassButton>
    </GlassSurface>
  );
}

function HeaderDemo() {
  return (
    <GlassHeader
      brand={<Link href="/">Acme</Link>}
      navigationLabel="Example navigation"
      position="static"
      actions={
        <GlassButton asChild size="sm" variant="prominent">
          <Link href="/docs">Start</Link>
        </GlassButton>
      }
    >
      <Link href="/components">Components</Link>
      <Link href="/docs">Docs</Link>
      <Link href="/guides">Guides</Link>
    </GlassHeader>
  );
}

function ButtonDemo() {
  const announce = useReleaseFeedback();

  return (
    <div className="cpreview-row">
      <GlassButton onClick={() => announce('Not now pressed.')}>Not now</GlassButton>
      <GlassButton onClick={() => announce('Continue pressed.')} variant="prominent">
        Continue
      </GlassButton>
    </div>
  );
}

function PanelDemo() {
  const [emphasized, setEmphasized] = useState(false);
  const announce = useReleaseFeedback();

  const toggleEmphasis = () => {
    const next = !emphasized;

    setEmphasized(next);
    announce(`Panel emphasis ${next ? 'enabled' : 'disabled'}.`);
  };

  return (
    <GlassPanel
      className="cpreview-panel"
      elevation={emphasized ? 'raised' : 'base'}
      preset={emphasized ? 'prominent' : 'standard'}
      variant="card"
    >
      <GlassButton
        aria-label="Toggle panel emphasis"
        aria-pressed={emphasized}
        onClick={toggleEmphasis}
        size="sm"
        variant="soft"
      >
        Toggle emphasis
      </GlassButton>
    </GlassPanel>
  );
}

function InputDemo() {
  const [value, setValue] = useState('');
  const [invalid, setInvalid] = useState(false);
  const announce = useReleaseFeedback();

  const save = () => {
    const name = value.trim();

    setInvalid(name.length === 0);
    announce(name.length === 0 ? 'Enter a name to save.' : `Saved ${name}.`);
  };

  return (
    <form
      className="cpreview-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <GlassInput
        aria-invalid={invalid || undefined}
        label="Name"
        placeholder="Ada Lovelace"
        value={value}
        onChange={(event) => {
          setValue(event.currentTarget.value);

          if (invalid) setInvalid(false);
        }}
      />
      <GlassButton type="submit" variant="prominent">
        Save
      </GlassButton>
    </form>
  );
}

function SwitchDemo() {
  const id = useId();
  const [notifications, setNotifications] = useState(true);
  const [autosave, setAutosave] = useState(false);
  const announce = useReleaseFeedback();

  return (
    <GlassPanel className="cpreview-list" variant="card">
      <div className="cpreview-list-row">
        <label htmlFor={`${id}notifications`}>Notifications</label>
        <GlassSwitch
          checked={notifications}
          id={`${id}notifications`}
          onCheckedChange={(checked) => {
            setNotifications(checked);
            announce(`Notifications turned ${checked ? 'on' : 'off'}.`);
          }}
        />
      </div>
      <div className="cpreview-list-row">
        <label htmlFor={`${id}autosave`}>Autosave</label>
        <GlassSwitch
          checked={autosave}
          id={`${id}autosave`}
          onCheckedChange={(checked) => {
            setAutosave(checked);
            announce(`Autosave turned ${checked ? 'on' : 'off'}.`);
          }}
        />
      </div>
    </GlassPanel>
  );
}

function SliderDemo() {
  const [volume, setVolume] = useState([60]);
  const announce = useReleaseFeedback();

  return (
    <div className="cpreview-slider">
      <SpeakerGlyph className="site-glyph site-glyph--small" loud={false} />
      <GlassSlider
        aria-label="Volume"
        className="cpreview-slider-control"
        max={100}
        onValueChange={setVolume}
        onValueCommit={([value]) => announce(`Volume ${value}%.`)}
        value={volume}
      />
      <SpeakerGlyph className="site-glyph" loud />
    </div>
  );
}

const VIEWS = ['Day', 'Week', 'Month'];

function SegmentedControlDemo() {
  const [view, setView] = useState('Week');
  const announce = useReleaseFeedback();

  return (
    <GlassSegmentedControl
      aria-label="View"
      className="cpreview-segmented"
      onValueChange={(next) => {
        setView(next);
        announce(`${next} view selected.`);
      }}
      value={view}
    >
      {VIEWS.map((option) => (
        <GlassSegmentedControlItem key={option} value={option}>
          {option}
        </GlassSegmentedControlItem>
      ))}
    </GlassSegmentedControl>
  );
}

const BADGES: Array<{ dot: boolean; label: string; tone: GlassBadgeTone }> = [
  { dot: true, label: 'Live', tone: 'green' },
  { dot: false, label: 'New', tone: 'blue' },
  { dot: false, label: 'Beta', tone: 'orange' },
  { dot: true, label: 'Paused', tone: 'orange' },
  { dot: true, label: 'Failed', tone: 'red' },
  { dot: false, label: 'Draft', tone: 'neutral' },
];

function BadgeDemo() {
  return (
    <div className="cpreview-badges">
      {BADGES.map((badge) => (
        <GlassBadge key={badge.label} dot={badge.dot} tone={badge.tone}>
          {badge.label}
        </GlassBadge>
      ))}
    </div>
  );
}

function DockDemo() {
  const announce = useReleaseFeedback();

  return <DockExample onAction={announce} />;
}

function TabsDemo() {
  const [value, setValue] = useState('overview');
  const announce = useReleaseFeedback();

  return (
    <GlassTabs
      className="docs-glass-tabs"
      value={value}
      onValueChange={(nextValue) => {
        setValue(nextValue);
        announce(`${nextValue === 'overview' ? 'Overview' : 'Details'} tab selected.`);
      }}
    >
      <GlassTabsList className="docs-glass-tab-list" aria-label="Sections">
        <GlassTabsTrigger value="overview">Overview</GlassTabsTrigger>
        <GlassTabsTrigger value="details">Details</GlassTabsTrigger>
      </GlassTabsList>
      <GlassTabsContent className="docs-glass-tab-panel" value="overview">
        A glass lozenge slides to the selected tab.
      </GlassTabsContent>
      <GlassTabsContent className="docs-glass-tab-panel" value="details">
        The arrow keys move between tabs.
      </GlassTabsContent>
    </GlassTabs>
  );
}

function DialogDemo() {
  const [open, setOpen] = useState(false);
  const announce = useReleaseFeedback();
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <GlassDialog
      modal={false}
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);

        if (!nextOpen) triggerRef.current?.focus();

        announce(`Dialog ${nextOpen ? 'opened' : 'closed'}.`);
      }}
    >
      <GlassDialogTrigger asChild>
        <GlassButton ref={triggerRef}>Open dialog</GlassButton>
      </GlassDialogTrigger>
      <GlassDialogContent
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          triggerRef.current?.focus();
        }}
      >
        <GlassDialogTitle>Glass dialog</GlassDialogTitle>
        <GlassDialogDescription>
          Press Escape or the close button to dismiss it.
        </GlassDialogDescription>
      </GlassDialogContent>
    </GlassDialog>
  );
}

function PopoverDemo() {
  const [open, setOpen] = useState(false);
  const announce = useReleaseFeedback();

  return (
    <GlassPopover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        announce(`Popover ${nextOpen ? 'opened' : 'closed'}.`);
      }}
    >
      <GlassPopoverTrigger asChild>
        <GlassButton>Open popover</GlassButton>
      </GlassPopoverTrigger>
      <GlassPopoverContent aria-label="Glass popover">
        Anchored to its trigger. Press Escape to close.
      </GlassPopoverContent>
    </GlassPopover>
  );
}

function SheetDemo() {
  const [open, setOpen] = useState(false);
  const announce = useReleaseFeedback();

  return (
    <GlassSheet
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        announce(`Sheet ${nextOpen ? 'opened' : 'closed'}.`);
      }}
    >
      <GlassSheetTrigger asChild>
        <GlassButton>Open sheet</GlassButton>
      </GlassSheetTrigger>
      <GlassSheetContent className="cpreview-sheet">
        <GlassSheetTitle className="cpreview-sheet-title">Glass sheet</GlassSheetTitle>
        <GlassSheetDescription className="cpreview-sheet-description">
          Drag the handle down or press Escape to close.
        </GlassSheetDescription>
      </GlassSheetContent>
    </GlassSheet>
  );
}

const SORT_ORDERS = ['Name', 'Date', 'Size'];

function MenuDemo() {
  const [sidebar, setSidebar] = useState(true);
  const [sort, setSort] = useState('Name');
  const announce = useReleaseFeedback();

  return (
    <GlassMenu>
      <GlassMenuTrigger asChild>
        <GlassButton>Options</GlassButton>
      </GlassMenuTrigger>
      <GlassMenuContent>
        <GlassMenuItem inset onSelect={() => announce('New window chosen.')}>
          New window
          <GlassMenuShortcut>⌘N</GlassMenuShortcut>
        </GlassMenuItem>
        <GlassMenuItem inset onSelect={() => announce('Duplicate chosen.')}>
          Duplicate
          <GlassMenuShortcut>⌘D</GlassMenuShortcut>
        </GlassMenuItem>
        <GlassMenuSeparator />
        <GlassMenuCheckboxItem
          checked={sidebar}
          onCheckedChange={(checked) => {
            setSidebar(checked);
            announce(`Sidebar ${checked ? 'shown' : 'hidden'}.`);
          }}
        >
          Show sidebar
        </GlassMenuCheckboxItem>
        <GlassMenuSeparator />
        <GlassMenuLabel>Sort by</GlassMenuLabel>
        <GlassMenuRadioGroup
          onValueChange={(next) => {
            setSort(next);
            announce(`Sorted by ${next.toLowerCase()}.`);
          }}
          value={sort}
        >
          {SORT_ORDERS.map((order) => (
            <GlassMenuRadioItem key={order} value={order}>
              {order}
            </GlassMenuRadioItem>
          ))}
        </GlassMenuRadioGroup>
        <GlassMenuSeparator />
        <GlassMenuItem inset onSelect={() => announce('Deleted.')} tone="destructive">
          Delete
        </GlassMenuItem>
      </GlassMenuContent>
    </GlassMenu>
  );
}

function TooltipDemo() {
  const announce = useReleaseFeedback();

  return (
    <GlassTooltipProvider delayDuration={0} skipDelayDuration={0}>
      <GlassTooltip onOpenChange={(open) => announce(`Tooltip ${open ? 'shown' : 'hidden'}.`)}>
        <GlassTooltipTrigger asChild>
          <GlassButton>Show tooltip</GlassButton>
        </GlassTooltipTrigger>
        <GlassTooltipContent>Opens on hover and on keyboard focus.</GlassTooltipContent>
      </GlassTooltip>
    </GlassTooltipProvider>
  );
}

function ToastDemo() {
  const [open, setOpen] = useState(false);
  const announce = useReleaseFeedback();

  return (
    <GlassToastProvider duration={Infinity}>
      <GlassButton
        onClick={() => {
          setOpen(true);
          announce('Toast shown.');
        }}
      >
        Show toast
      </GlassButton>
      <GlassToast
        aria-label="Glass toast"
        duration={Infinity}
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);

          if (!nextOpen) announce('Toast dismissed.');
        }}
      >
        <GlassToastTitle>Glass toast</GlassToastTitle>
        <GlassToastDescription>It stays until you dismiss it.</GlassToastDescription>
        <GlassToastClose />
      </GlassToast>
      <GlassToastViewport className="top-20" />
    </GlassToastProvider>
  );
}

function AccordionDemo() {
  const [value, setValue] = useState('');
  const announce = useReleaseFeedback();

  return (
    <GlassAccordion
      className="docs-glass-accordion"
      collapsible
      type="single"
      value={value}
      onValueChange={(nextValue) => {
        setValue(nextValue);
        announce(`Answer ${nextValue ? 'expanded' : 'collapsed'}.`);
      }}
    >
      <GlassAccordionItem value="glass">
        <GlassAccordionTrigger>What makes it glass?</GlassAccordionTrigger>
        <GlassAccordionContent>
          Frost, a specular rim and, in Chromium, an edge that bends the light behind it.
        </GlassAccordionContent>
      </GlassAccordionItem>
    </GlassAccordion>
  );
}

const CHANNELS = ['Email', 'Push', 'Text message'];

function CheckboxDemo() {
  const [selected, setSelected] = useState(['Email']);
  const announce = useReleaseFeedback();

  const overall =
    selected.length === CHANNELS.length ? true : selected.length === 0 ? false : 'indeterminate';

  return (
    <GlassPanel className="cpreview-choices" variant="card">
      <GlassCheckbox
        checked={overall}
        label="All channels"
        onCheckedChange={(checked) => {
          setSelected(checked === true ? CHANNELS : []);
          announce(checked === true ? 'All channels selected.' : 'All channels cleared.');
        }}
      />
      <div className="cpreview-choices-nested">
        {CHANNELS.map((channel) => (
          <GlassCheckbox
            checked={selected.includes(channel)}
            key={channel}
            label={channel}
            onCheckedChange={(checked) => {
              setSelected((current) =>
                checked === true
                  ? [...current, channel]
                  : current.filter((item) => item !== channel),
              );
              announce(`${channel} ${checked === true ? 'selected' : 'cleared'}.`);
            }}
            size="sm"
          />
        ))}
      </div>
    </GlassPanel>
  );
}

const PLANS = [
  { description: 'For trying things out.', label: 'Starter', value: 'starter' },
  { description: 'For teams shipping weekly.', label: 'Pro', value: 'pro' },
  { description: 'For everything else.', label: 'Scale', value: 'scale' },
];

function RadioGroupDemo() {
  const [plan, setPlan] = useState('pro');
  const announce = useReleaseFeedback();

  return (
    <GlassPanel className="cpreview-choices" variant="card">
      <GlassRadioGroup
        aria-label="Plan"
        onValueChange={(next) => {
          setPlan(next);
          announce(`${PLANS.find((item) => item.value === next)?.label} plan selected.`);
        }}
        value={plan}
      >
        {PLANS.map((item) => (
          <GlassRadioGroupItem
            description={item.description}
            key={item.value}
            label={item.label}
            value={item.value}
          />
        ))}
      </GlassRadioGroup>
    </GlassPanel>
  );
}

function TextareaDemo() {
  const [value, setValue] = useState('');
  const announce = useReleaseFeedback();

  return (
    <form
      className="cpreview-stack"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        announce(
          value.trim() ? `Sent ${value.trim().length} characters.` : 'Write a message first.',
        );
      }}
    >
      <GlassTextarea
        autoResize
        hint="Grows as you type, up to five rows."
        label="Message"
        maxRows={5}
        onChange={(event) => setValue(event.currentTarget.value)}
        placeholder="Say hello…"
        value={value}
      />
      <GlassButton type="submit" variant="prominent">
        Send
      </GlassButton>
    </form>
  );
}

function SelectDemo() {
  const [value, setValue] = useState('');
  const announce = useReleaseFeedback();

  return (
    <div className="cpreview-stack">
      <GlassSelect
        onValueChange={(next) => {
          setValue(next);
          announce(`${next} selected.`);
        }}
        value={value}
      >
        <GlassSelectTrigger aria-label="Framework">
          <GlassSelectValue placeholder="Choose a framework" />
        </GlassSelectTrigger>
        <GlassSelectContent>
          <GlassSelectGroup>
            <GlassSelectLabel>React</GlassSelectLabel>
            <GlassSelectItem value="Next.js">Next.js</GlassSelectItem>
            <GlassSelectItem value="Remix">Remix</GlassSelectItem>
          </GlassSelectGroup>
          <GlassSelectSeparator />
          <GlassSelectGroup>
            <GlassSelectLabel>Other</GlassSelectLabel>
            <GlassSelectItem value="Astro">Astro</GlassSelectItem>
            <GlassSelectItem value="SvelteKit">SvelteKit</GlassSelectItem>
          </GlassSelectGroup>
        </GlassSelectContent>
      </GlassSelect>
    </div>
  );
}

function ProgressDemo() {
  const [value, setValue] = useState(35);
  const announce = useReleaseFeedback();

  return (
    <div className="cpreview-stack">
      <GlassProgress label="Uploading" showValue value={value} />
      <GlassProgress aria-label="Working" size="sm" value={null} />
      <div className="cpreview-row">
        <GlassButton
          onClick={() => {
            const next = value >= 100 ? 0 : Math.min(100, value + 25);

            setValue(next);
            announce(`Progress ${next}%.`);
          }}
          size="sm"
          variant="soft"
        >
          {value >= 100 ? 'Restart' : 'Advance'}
        </GlassButton>
      </div>
    </div>
  );
}

function SpinnerDemo() {
  return (
    <div className="cpreview-row cpreview-row--center">
      <GlassSpinner label="Loading small" size="sm" />
      <GlassSpinner label="Loading" />
      <GlassSpinner label="Loading large" size="lg" />
    </div>
  );
}

function SkeletonDemo() {
  const [loading, setLoading] = useState(true);
  const announce = useReleaseFeedback();

  return (
    <div className="cpreview-stack">
      <GlassPanel aria-busy={loading} className="cpreview-card" variant="card">
        {loading ? (
          <div className="cpreview-profile">
            <GlassSkeleton variant="circle" />
            <div className="cpreview-profile-text">
              <GlassSkeleton style={{ height: '0.875rem', width: '55%' }} />
              <GlassSkeleton variant="text" lines={2} />
            </div>
          </div>
        ) : (
          <div className="cpreview-profile">
            <GlassAvatar name="Ada Lovelace" />
            <div className="cpreview-profile-text">
              <strong>Ada Lovelace</strong>
              <span>Wrote the first program, before there were computers to run it.</span>
            </div>
          </div>
        )}
      </GlassPanel>
      <div className="cpreview-row">
        <GlassButton
          onClick={() => {
            setLoading(!loading);
            announce(loading ? 'Content loaded.' : 'Loading again.');
          }}
          size="sm"
          variant="soft"
        >
          {loading ? 'Load content' : 'Load again'}
        </GlassButton>
      </div>
    </div>
  );
}

function AlertDemo() {
  const [dismissed, setDismissed] = useState(false);
  const announce = useReleaseFeedback();
  const role = useContext(QuietDemos) ? 'note' : undefined;

  return (
    <div className="cpreview-stack cpreview-stack--alerts cpreview-stack--wide">
      <GlassAlert role={role} title="Heads up">
        Your trial ends in three days.
      </GlassAlert>
      <GlassAlert role={role} title="Saved" tone="success">
        Every change is in.
      </GlassAlert>
      <GlassAlert role={role} title="Almost full" tone="warning">
        You have used 92% of your storage.
      </GlassAlert>
      {dismissed ? null : (
        <GlassAlert
          onDismiss={() => {
            setDismissed(true);
            announce('Alert dismissed.');
          }}
          role={role}
          title="Payment failed"
          tone="danger"
        >
          Update your card to keep your plan.
        </GlassAlert>
      )}
    </div>
  );
}

const PEOPLE = [
  'Ada Lovelace',
  'Grace Hopper',
  'Alan Turing',
  'Katherine Johnson',
  'Linus Torvalds',
];

function AvatarDemo() {
  return (
    <div className="cpreview-stack cpreview-stack--center">
      <div className="cpreview-row cpreview-row--center">
        <GlassAvatar name="Ada Lovelace" size="sm" />
        <GlassAvatar name="Grace Hopper" status="online" />
        <GlassAvatar name="Alan Turing" size="lg" status="away" />
        <GlassAvatar name="Katherine Johnson" size="xl" status="busy" />
      </div>
      <GlassAvatarGroup aria-label="Team" max={4}>
        {PEOPLE.map((person) => (
          <GlassAvatar key={person} name={person} />
        ))}
      </GlassAvatarGroup>
    </div>
  );
}

function KbdDemo() {
  return (
    <GlassPanel className="cpreview-list" variant="card">
      <div className="cpreview-list-row">
        <span>Search</span>
        <GlassKbdGroup>
          <GlassKbd>⌘</GlassKbd>
          <GlassKbd>K</GlassKbd>
        </GlassKbdGroup>
      </div>
      <div className="cpreview-list-row">
        <span>Undo</span>
        <GlassKbdGroup>
          <GlassKbd>⌘</GlassKbd>
          <GlassKbd>Z</GlassKbd>
        </GlassKbdGroup>
      </div>
      <div className="cpreview-list-row">
        <span>Close</span>
        <GlassKbd>esc</GlassKbd>
      </div>
    </GlassPanel>
  );
}

const RELEASE_NOTES = [
  { title: 'Version 2.6', detail: 'Search finds files by their contents.' },
  { title: 'Version 2.5', detail: 'Shared folders sync in the background.' },
  { title: 'Version 2.4', detail: 'Pin a project to keep it at the top.' },
  { title: 'Version 2.3', detail: 'Undo now reaches back a whole day.' },
  { title: 'Version 2.2', detail: 'Export a board as a single image.' },
  { title: 'Version 2.1', detail: 'Comments show who has read them.' },
];

// The notes overflow the card, so the bar shows whenever the area can scroll ("auto") and the
// preview and its share card both show the glass thumb; the component's own default is "hover".
function ScrollAreaDemo() {
  return (
    <GlassPanel className="cpreview-scroll" variant="card">
      <GlassScrollArea
        className="cpreview-scroll-area"
        type="auto"
        viewportProps={{ 'aria-label': 'Release notes', role: 'region', tabIndex: 0 }}
      >
        <ul className="cpreview-scroll-list" role="list">
          {RELEASE_NOTES.map((note) => (
            <li key={note.title}>
              <strong>{note.title}</strong>
              <span>{note.detail}</span>
            </li>
          ))}
        </ul>
      </GlassScrollArea>
    </GlassPanel>
  );
}

const COMMAND_GROUPS = [
  {
    commands: [
      { keys: ['⌘', 'N'], label: 'New file' },
      { keys: ['⌘', 'O'], label: 'Open recent' },
      { keys: [], label: 'Copy link' },
    ],
    heading: 'Suggestions',
  },
  {
    commands: [
      { keys: ['⌘', ','], label: 'Preferences' },
      { keys: [], label: 'Switch theme' },
    ],
    heading: 'Settings',
  },
];

function CommandDemo() {
  const [open, setOpen] = useState(false);
  const announce = useReleaseFeedback();

  return (
    <>
      <GlassButton onClick={() => setOpen(true)}>Open command menu</GlassButton>
      <GlassCommandDialog onOpenChange={setOpen} open={open}>
        <GlassCommand label="Commands">
          <GlassCommandInput placeholder="Type a command or search…" />
          <GlassCommandList>
            <GlassCommandEmpty>No results found.</GlassCommandEmpty>
            {COMMAND_GROUPS.map((group, index) => (
              <div key={group.heading}>
                {index > 0 ? <GlassCommandSeparator /> : null}
                <GlassCommandGroup heading={group.heading}>
                  {group.commands.map((command) => (
                    <GlassCommandItem
                      key={command.label}
                      onSelect={() => {
                        setOpen(false);
                        announce(`${command.label} chosen.`);
                      }}
                    >
                      {command.label}
                      {command.keys.length ? (
                        <GlassCommandShortcut>
                          <GlassKbdGroup>
                            {command.keys.map((key) => (
                              <GlassKbd key={key}>{key}</GlassKbd>
                            ))}
                          </GlassKbdGroup>
                        </GlassCommandShortcut>
                      ) : null}
                    </GlassCommandItem>
                  ))}
                </GlassCommandGroup>
              </div>
            ))}
          </GlassCommandList>
        </GlassCommand>
      </GlassCommandDialog>
    </>
  );
}

function BreadcrumbDemo() {
  const announce = useReleaseFeedback();

  return (
    <GlassPanel className="cpreview-bar" variant="pill">
      <GlassBreadcrumb>
        <GlassBreadcrumbItem>
          <GlassBreadcrumbLink
            href="#home"
            onClick={(event) => {
              event.preventDefault();
              announce('Home chosen.');
            }}
          >
            Home
          </GlassBreadcrumbLink>
        </GlassBreadcrumbItem>
        <GlassBreadcrumbItem>
          <GlassMenu>
            <GlassMenuTrigger asChild>
              <GlassBreadcrumbEllipsis />
            </GlassMenuTrigger>
            <GlassMenuContent align="start">
              <GlassMenuItem onSelect={() => announce('Docs chosen.')}>Docs</GlassMenuItem>
              <GlassMenuItem onSelect={() => announce('Components chosen.')}>
                Components
              </GlassMenuItem>
            </GlassMenuContent>
          </GlassMenu>
        </GlassBreadcrumbItem>
        <GlassBreadcrumbItem>
          <GlassBreadcrumbPage>Breadcrumb</GlassBreadcrumbPage>
        </GlassBreadcrumbItem>
      </GlassBreadcrumb>
    </GlassPanel>
  );
}

function PaginationDemo() {
  const [page, setPage] = useState(5);
  const announce = useReleaseFeedback();

  return (
    <GlassPanel className="cpreview-bar" variant="pill">
      <GlassPagination
        onPageChange={(next) => {
          setPage(next);
          announce(`Page ${next}.`);
        }}
        page={page}
        pageCount={12}
        siblingCount={0}
      />
    </GlassPanel>
  );
}

function SceneDemo() {
  const announce = useReleaseFeedback();

  return <SceneExample onAction={announce} />;
}

// The homepage desk on the laptop's screen. A gallery tile shows it without the controls.
function LaptopDemo() {
  const quiet = useContext(QuietDemos);

  return <LaptopShowcase quiet={quiet} />;
}

function PhoneDuoDemo() {
  const quiet = useContext(QuietDemos);

  return <PhoneDuoShowcase quiet={quiet} />;
}

const DEMOS = {
  'glass-accordion': AccordionDemo,
  'glass-alert': AlertDemo,
  'glass-avatar': AvatarDemo,
  'glass-badge': BadgeDemo,
  'glass-breadcrumb': BreadcrumbDemo,
  'glass-button': ButtonDemo,
  'glass-checkbox': CheckboxDemo,
  'glass-command': CommandDemo,
  'glass-dialog': DialogDemo,
  'glass-dock': DockDemo,
  'glass-header': HeaderDemo,
  'glass-input': InputDemo,
  'glass-kbd': KbdDemo,
  'glass-lens': LensExample,
  'glass-laptop': LaptopDemo,
  'glass-menu': MenuDemo,
  'glass-pagination': PaginationDemo,
  'glass-panel': PanelDemo,
  'glass-phone-duo': PhoneDuoDemo,
  'glass-popover': PopoverDemo,
  'glass-progress': ProgressDemo,
  'glass-provider': ProviderDemo,
  'glass-radio-group': RadioGroupDemo,
  'glass-scene': SceneDemo,
  'glass-scroll-area': ScrollAreaDemo,
  'glass-segmented-control': SegmentedControlDemo,
  'glass-select': SelectDemo,
  'glass-sheet': SheetDemo,
  'glass-skeleton': SkeletonDemo,
  'glass-slider': SliderDemo,
  'glass-spinner': SpinnerDemo,
  'glass-surface': SurfaceDemo,
  'glass-switch': SwitchDemo,
  'glass-tabs': TabsDemo,
  'glass-textarea': TextareaDemo,
  'glass-toast': ToastDemo,
  'glass-tooltip': TooltipDemo,
} satisfies Record<string, ComponentType>;

function isDemoId(id: string): id is keyof typeof DEMOS {
  return Object.hasOwn(DEMOS, id);
}

export function ComponentDemo({ id }: { id: string }) {
  if (!isDemoId(id)) throw new Error(`No demo exists for ${id}.`);

  const Demo = DEMOS[id];

  return (
    <div className="docs-release-demo" data-release-demo={id}>
      <Demo />
    </div>
  );
}
