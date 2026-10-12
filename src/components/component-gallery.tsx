'use client';

import type { ReactElement } from 'react';
import { useState } from 'react';
import {
  GlassAccordion,
  GlassAccordionContent,
  GlassAccordionItem,
  GlassAccordionTrigger,
  GlassButton,
  GlassDialog,
  GlassDialogContent,
  GlassDialogDescription,
  GlassDialogTitle,
  GlassDialogTrigger,
  GlassInput,
  GlassPopover,
  GlassPopoverContent,
  GlassPopoverTrigger,
  GlassTabs,
  GlassTabsContent,
  GlassTabsList,
  GlassTabsTrigger,
  GlassToast,
  GlassToastDescription,
  GlassToastProvider,
  GlassToastTitle,
  GlassToastViewport,
  GlassTooltip,
  GlassTooltipContent,
  GlassTooltipProvider,
  GlassTooltipTrigger,
  GlassPanel,
} from '@/components/liquid';

const BASE_COMPONENTS: Array<{ name: string; description: string; demo: () => ReactElement }> = [
  {
    name: 'Button',
    description: 'Primary action control with Glassy UI highlights.',
    demo: () => <GlassButton>Launch</GlassButton>,
  },
  {
    name: 'Input',
    description: 'Blurred surface input with rim focus state.',
    demo: () => <GlassInput label="Email" placeholder="you@glassyui.com" />,
  },
];

export function ComponentGallery() {
  const [openToast, setOpenToast] = useState(false);

  const components: Array<{ name: string; description: string; demo: () => ReactElement }> = [
    ...BASE_COMPONENTS,
    {
      name: 'Dialog',
      description: 'Elevated glass modal with inert backdrop.',
      demo: () => (
        <GlassDialog>
          <GlassDialogTrigger asChild>
            <GlassButton variant="ghost">Open dialog</GlassButton>
          </GlassDialogTrigger>
          <GlassDialogContent>
            <GlassDialogTitle className="text-xl font-semibold">Glassy UI Dialog</GlassDialogTitle>
            <GlassDialogDescription className="mt-3 text-sm text-[var(--lg-foreground)]/70">
              Dialog surfaces increase blur and alpha to separate them from the page.
            </GlassDialogDescription>
          </GlassDialogContent>
        </GlassDialog>
      ),
    },
    {
      name: 'Popover',
      description: 'Contextual surface with specular highlight.',
      demo: () => (
        <GlassPopover>
          <GlassPopoverTrigger asChild>
            <GlassButton variant="ghost">Show popover</GlassButton>
          </GlassPopoverTrigger>
          <GlassPopoverContent>
            <p className="text-sm text-[var(--lg-foreground)]/70">
              Popovers inherit the panel recipe for consistent glass layering.
            </p>
          </GlassPopoverContent>
        </GlassPopover>
      ),
    },
    {
      name: 'Tooltip',
      description: 'Compact informational hints with Clear/Tinted sync.',
      demo: () => (
        <GlassTooltipProvider>
          <GlassTooltip>
            <GlassTooltipTrigger asChild>
              <GlassButton size="sm">Hover me</GlassButton>
            </GlassTooltipTrigger>
            <GlassTooltipContent>Glassy clarity!</GlassTooltipContent>
          </GlassTooltip>
        </GlassTooltipProvider>
      ),
    },
    {
      name: 'Tabs',
      description: 'Sliding indicator with adaptive tint.',
      demo: () => (
        <GlassTabs defaultValue="overview">
          <GlassTabsList>
            <GlassTabsTrigger value="overview">Overview</GlassTabsTrigger>
            <GlassTabsTrigger value="specs">Specs</GlassTabsTrigger>
            <GlassTabsTrigger value="access">Access</GlassTabsTrigger>
          </GlassTabsList>
          <GlassTabsContent
            value="overview"
            className="mt-3 text-sm text-[var(--lg-foreground)]/70"
          >
            Layered surfaces adapt blur to context.
          </GlassTabsContent>
          <GlassTabsContent value="specs" className="mt-3 text-sm text-[var(--lg-foreground)]/70">
            Tokens ship as CSS variables and Tailwind recipes.
          </GlassTabsContent>
          <GlassTabsContent value="access" className="mt-3 text-sm text-[var(--lg-foreground)]/70">
            Reduce Transparency and Motion preferences are respected.
          </GlassTabsContent>
        </GlassTabs>
      ),
    },
    {
      name: 'Accordion',
      description: 'Stacked glass list with rim separators.',
      demo: () => (
        <GlassAccordion type="single" collapsible className="w-full">
          <GlassAccordionItem value="item-1">
            <GlassAccordionTrigger>What is Glassy UI?</GlassAccordionTrigger>
            <GlassAccordionContent>
              Glassy UI is our glass material system tailored for the web.
            </GlassAccordionContent>
          </GlassAccordionItem>
          <GlassAccordionItem value="item-2">
            <GlassAccordionTrigger>How does fallback work?</GlassAccordionTrigger>
            <GlassAccordionContent>
              Fallbacks remove blur when backdrop-filter is unavailable and boost contrast.
            </GlassAccordionContent>
          </GlassAccordionItem>
        </GlassAccordion>
      ),
    },
    {
      name: 'Toast',
      description: 'Elevated notifications with queue-aware portal.',
      demo: () => (
        <GlassToastProvider swipeDirection="right">
          <GlassButton onClick={() => setOpenToast(true)}>Trigger toast</GlassButton>
          <GlassToast open={openToast} onOpenChange={setOpenToast} duration={3000}>
            <GlassToastTitle>Saved to Library</GlassToastTitle>
            <GlassToastDescription>
              You can manage components from the dashboard.
            </GlassToastDescription>
          </GlassToast>
          <GlassToastViewport className="top-20" />
        </GlassToastProvider>
      ),
    },
  ];

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {components.map((component) => (
        <GlassPanel
          key={component.name}
          variant="card"
          elevation="raised"
          preset="standard"
          refraction="none"
          className="flex flex-col gap-4"
        >
          <header className="space-y-1">
            <h3 className="text-lg font-semibold">{component.name}</h3>
            <p className="text-sm text-[var(--lg-foreground)]/70">{component.description}</p>
          </header>
          <div className="relative z-10 flex min-h-[90px] flex-col justify-center gap-4">
            {component.demo()}
          </div>
        </GlassPanel>
      ))}
    </div>
  );
}
