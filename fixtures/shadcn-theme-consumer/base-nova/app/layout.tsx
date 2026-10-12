import "./globals.css"
import "./harness.css"

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="font-sans">
      <body>{children}</body>
    </html>
  )
}
