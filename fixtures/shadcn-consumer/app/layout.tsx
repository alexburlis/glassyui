import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-lg-theme="dark">
      <body>{children}</body>
    </html>
  );
}
