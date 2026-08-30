import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'GestureDrive CV',
  description: 'Real-time contactless computer vision vehicle control with MediaPipe hand landmark tracking and autonomous driving physics simulation.',
  openGraph: {
    title: 'GestureDrive CV',
    description: 'Real-time contactless computer vision vehicle control with MediaPipe hand landmark tracking and autonomous driving physics simulation.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GestureDrive CV',
    description: 'Real-time contactless computer vision vehicle control with MediaPipe hand landmark tracking and autonomous driving physics simulation.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
