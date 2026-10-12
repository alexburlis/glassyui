import {
  GlassAccordion,
  GlassAccordionContent,
  GlassAccordionItem,
  GlassAccordionTrigger,
} from '@/components/glassyui/glass-accordion';

export default function AccordionExample() {
  return (
    <GlassAccordion collapsible defaultValue="returns">
      <GlassAccordionItem value="returns">
        <GlassAccordionTrigger>Can I return an order?</GlassAccordionTrigger>
        <GlassAccordionContent>Yes, within 30 days of delivery.</GlassAccordionContent>
      </GlassAccordionItem>
      <GlassAccordionItem value="shipping">
        <GlassAccordionTrigger>How long does shipping take?</GlassAccordionTrigger>
        <GlassAccordionContent>Three to five working days.</GlassAccordionContent>
      </GlassAccordionItem>
    </GlassAccordion>
  );
}
