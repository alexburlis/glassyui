'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Kbd } from '@/components/ui/kbd';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// A stock shadcn/ui (base-nova, Base UI) kitchen sink. Only stock components are used; every glass
// effect comes from the installed theme. The query string picks the backdrop
// (?backdrop=plain|wallpaper), the colour scheme (?scheme=light|dark) and which
// overlay is open (?open=dropdown|select|popover|tooltip|dialog|sheet|command).
function KitchenSink() {
  const params = useSearchParams();
  const scheme = params.get('scheme') === 'dark' ? 'dark' : 'light';
  const backdrop = params.get('backdrop') === 'wallpaper' ? 'wallpaper' : 'plain';
  const open = params.get('open');

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', scheme === 'dark');
    root.dataset.backdrop = backdrop;
    root.dataset.ready = 'true';
  }, [scheme, backdrop]);

  return (
    <TooltipProvider delay={0}>
      <main className="mx-auto grid max-w-5xl gap-10 p-10">
        <section data-check="buttons" className="flex flex-wrap items-center gap-3">
          <Button data-check="button-default">Continue</Button>
          <Button data-check="button-secondary" variant="secondary">
            Secondary
          </Button>
          <Button data-check="button-outline" variant="outline">
            Outline
          </Button>
          <Button data-check="button-ghost" variant="ghost">
            Ghost
          </Button>
          <Button data-check="button-destructive" variant="destructive">
            Delete
          </Button>
          <Button variant="link">Link</Button>
          <Button data-check="button-small" size="sm">
            Small
          </Button>
          <Button size="lg">Large</Button>
          <Button size="icon" aria-label="Add">
            +
          </Button>
          <Button disabled>Disabled</Button>
          {/* Buttons copied before shadcn added data-variant carry only their classes. */}
          <Button data-check="legacy-outline" data-variant={undefined} variant="outline">
            Older outline
          </Button>
          <Button data-check="legacy-ghost" data-variant={undefined} variant="ghost">
            Older ghost
          </Button>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button data-check="trigger-ghost" variant="ghost" size="icon" aria-label="More" />
              }
            >
              ⋯
            </TooltipTrigger>
            <TooltipContent>More</TooltipContent>
          </Tooltip>
        </section>

        <section data-check="badges" className="flex flex-wrap items-center gap-3">
          <Badge>New</Badge>
          <Badge variant="secondary">Beta</Badge>
          <Badge variant="destructive">Error</Badge>
          <Badge variant="outline">Draft</Badge>
          <Kbd>⌘K</Kbd>
        </section>

        <section data-check="surfaces" className="grid gap-6 md:grid-cols-2">
          <Card data-check="card">
            <CardHeader>
              <CardTitle>Morning focus</CardTitle>
              <CardDescription>Three tasks left before noon.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Input data-check="input" placeholder="Add a task" />
              <Textarea placeholder="Notes" />
            </CardContent>
            <CardFooter className="gap-3">
              <Button>Save</Button>
              <Button variant="outline">Cancel</Button>
            </CardFooter>
          </Card>
          <div className="grid gap-4">
            <Alert>
              <AlertTitle>Heads up</AlertTitle>
              <AlertDescription>Your trial ends in three days.</AlertDescription>
            </Alert>
            <Alert variant="destructive">
              <AlertTitle>Payment failed</AlertTitle>
              <AlertDescription>Update your card to keep your plan.</AlertDescription>
            </Alert>
            <div className="flex items-center gap-4">
              <Avatar>
                <AvatarImage src="/avatar.svg" alt="Avery" />
                <AvatarFallback>AV</AvatarFallback>
              </Avatar>
              <Avatar>
                <AvatarFallback>JB</AvatarFallback>
              </Avatar>
              <Skeleton className="h-10 w-40" />
            </div>
          </div>
        </section>

        <section data-check="controls" className="grid gap-6 md:grid-cols-2">
          <div className="grid gap-4">
            <Select
              defaultValue="week"
              items={[
                { label: 'Today', value: 'day' },
                { label: 'This week', value: 'week' },
                { label: 'This month', value: 'month' },
              ]}
              defaultOpen={open === 'select'}
            >
              <SelectTrigger data-check="select-trigger" className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Today</SelectItem>
                <SelectItem value="week">This week</SelectItem>
                <SelectItem value="month">This month</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-3">
              <Checkbox id="terms" defaultChecked />
              <label htmlFor="terms">Accept terms</label>
              <Checkbox id="news" />
              <label htmlFor="news">Newsletter</label>
            </div>
            <RadioGroup defaultValue="b" className="flex gap-4">
              <RadioGroupItem value="a" aria-label="Option A" />
              <RadioGroupItem value="b" aria-label="Option B" />
              <RadioGroupItem value="c" aria-label="Option C" />
            </RadioGroup>
          </div>
          <div className="grid gap-4">
            <div className="flex items-center gap-3">
              <Switch data-check="switch-on" defaultChecked aria-label="Wi-Fi" />
              <Switch data-check="switch-off" aria-label="Bluetooth" />
            </div>
            <Slider data-check="slider" defaultValue={[40]} max={100} aria-label="Volume" />
          </div>
        </section>

        <section data-check="tabs" className="grid gap-4">
          <Tabs defaultValue="overview">
            <TabsList data-check="tabs-list">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
              <TabsTrigger value="reports">Reports</TabsTrigger>
            </TabsList>
            <TabsContent value="overview">Overview content</TabsContent>
            <TabsContent value="analytics">Analytics content</TabsContent>
            <TabsContent value="reports">Reports content</TabsContent>
          </Tabs>
          <Tabs defaultValue="one">
            <TabsList variant="line" data-check="tabs-line">
              <TabsTrigger value="one">One</TabsTrigger>
              <TabsTrigger value="two">Two</TabsTrigger>
            </TabsList>
          </Tabs>
        </section>

        <section data-check="accordion">
          <Accordion defaultValue={['a']}>
            <AccordionItem value="a">
              <AccordionTrigger>What is glass?</AccordionTrigger>
              <AccordionContent>A material that bends light at its rim.</AccordionContent>
            </AccordionItem>
            <AccordionItem value="b">
              <AccordionTrigger>Does it need JavaScript?</AccordionTrigger>
              <AccordionContent>No. This theme is CSS only.</AccordionContent>
            </AccordionItem>
          </Accordion>
        </section>

        <section data-check="overrides" className="flex flex-wrap items-center gap-3">
          <Button data-check="override-radius" className="rounded-none">
            Square
          </Button>
          <Card data-check="override-bg" className="bg-red-500/40 px-6 py-3">
            Red card
          </Card>
          <Input
            data-check="override-shadow"
            className="w-40 shadow-none"
            placeholder="No shadow"
          />
          <Input
            data-check="override-inset"
            className="w-40 inset-shadow-none"
            placeholder="No rim"
          />
          <Input
            data-check="override-fill"
            className="w-40 bg-none bg-amber-100"
            placeholder="Own fill"
          />
          <Button data-check="dark-root-button" className="dark">
            Dark root
          </Button>
        </section>

        <section data-check="overlays" className="stripes flex flex-wrap items-start gap-3 p-6">
          <DropdownMenu defaultOpen={open === 'dropdown'} modal={false}>
            <DropdownMenuTrigger render={<Button data-check="trigger-menu" variant="outline" />}>
              Menu
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="start">
              <DropdownMenuGroup>
                <DropdownMenuLabel>My account</DropdownMenuLabel>
                <DropdownMenuItem>
                  Profile <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem>Billing</DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem checked>Show status bar</DropdownMenuCheckboxItem>
              <DropdownMenuRadioGroup value="top">
                <DropdownMenuRadioItem value="top">Top</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="bottom">Bottom</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive">Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Popover defaultOpen={open === 'popover'}>
            <PopoverTrigger render={<Button variant="outline" />}>Popover</PopoverTrigger>
            <PopoverContent>Dimensions and spacing for this layer.</PopoverContent>
          </Popover>

          <Tooltip defaultOpen={open === 'tooltip'}>
            <TooltipTrigger render={<Button variant="outline" />}>Tooltip</TooltipTrigger>
            <TooltipContent>Add to library</TooltipContent>
          </Tooltip>
        </section>

        <Dialog defaultOpen={open === 'dialog'}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Share this view</DialogTitle>
              <DialogDescription>Anyone with the link can see it.</DialogDescription>
            </DialogHeader>
            <Input defaultValue="https://example.com/view/42" readOnly />
            <DialogFooter>
              <Button variant="outline">Cancel</Button>
              <Button>Copy link</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Sheet defaultOpen={open === 'sheet'}>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
              <SheetDescription>Narrow the list.</SheetDescription>
            </SheetHeader>
          </SheetContent>
        </Sheet>

        <CommandDialog defaultOpen={open === 'command'}>
          <Command>
            <CommandInput placeholder="Type a command" />
            <CommandList>
              <CommandEmpty>No results.</CommandEmpty>
              <CommandGroup heading="Suggestions">
                <CommandItem>Calendar</CommandItem>
                <CommandItem>Search emoji</CommandItem>
                <CommandItem>Calculator</CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </CommandDialog>
      </main>
    </TooltipProvider>
  );
}

export default function Page() {
  return (
    <Suspense>
      <KitchenSink />
    </Suspense>
  );
}
