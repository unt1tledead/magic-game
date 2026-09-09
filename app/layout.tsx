import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Cam Control Center',
  description: 'Professional local dashboard for an IP Webcam device'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
