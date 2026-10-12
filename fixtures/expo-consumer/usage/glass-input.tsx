import { useState } from 'react';
import { GlassInput } from '@/components/glassyui/glass-input';

export default function InputExample() {
  const [email, setEmail] = useState('');

  return (
    <GlassInput
      autoCapitalize="none"
      hint="We only use it to reply."
      keyboardType="email-address"
      label="Email"
      onChangeText={setEmail}
      placeholder="you@example.com"
      value={email}
    />
  );
}
