import {
  GlassTabs,
  GlassTabsContent,
  GlassTabsList,
  GlassTabsTrigger,
} from '@/components/glassyui/glass-tabs';

export default function TabsExample() {
  return (
    <GlassTabs defaultValue="overview">
      <GlassTabsList>
        <GlassTabsTrigger value="overview">Overview</GlassTabsTrigger>
        <GlassTabsTrigger value="activity">Activity</GlassTabsTrigger>
      </GlassTabsList>
      <GlassTabsContent value="overview">Three projects, all up to date.</GlassTabsContent>
      <GlassTabsContent value="activity">No activity this week.</GlassTabsContent>
    </GlassTabs>
  );
}
