import { useState } from 'react';
import { GlassTextarea } from '@/components/glassyui/glass-textarea';

export default function TextareaExample() {
  const [notes, setNotes] = useState('');

  return (
    <GlassTextarea
      label="Notes"
      maxRows={6}
      onChangeText={setNotes}
      placeholder="Add a note"
      value={notes}
    />
  );
}
