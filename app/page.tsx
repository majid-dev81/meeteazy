// app/page.tsx

import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'
import { CalendarDays } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Meeteazy — Smart & Effortless Scheduling',
  description:
    'Meeteazy makes it simple to share your availability, receive meeting requests, and stay organized. Perfect for professionals, teams, and freelancers.',
  openGraph: {
    title: 'Meeteazy — Smart & Effortless Scheduling',
    description:
      'Share your availability, receive meeting requests, and stay organized — all with Meeteazy.',
    url: 'https://meeteazy.com',
    siteName: 'Meeteazy',
    images: [
      {
        url: 'https://meeteazy.com/logo.png',
        width: 600,
        height: 600,
        alt: 'Meeteazy Logo',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Meeteazy — Smart & Effortless Scheduling',
    description:
      'Share your availability, receive meeting requests, and stay organized — all with Meeteazy.',
    images: ['https://meeteazy.com/logo.png'],
  },
}

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-gray-100 flex flex-col items-center justify-center px-4 py-12 text-center font-sans tracking-wide text-sm">
      <div className="max-w-2xl w-full space-y-10">
        {/* Logo */}
        <div className="flex justify-center">
          <Image
            src="/logo.png"
            alt="Meeteazy logo"
            width={320}
            height={320}
            className="w-32 h-32 sm:w-40 sm:h-40 md:w-52 md:h-52 mx-auto"
            priority
          />
        </div>

        {/* Title */}
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-gray-800 leading-snug flex items-center justify-center gap-2">
          <CalendarDays size={28} className="text-blue-600" />
          Smart, Simple & Effortless Scheduling
        </h1>

        {/* Subheading */}
        <p className="text-base sm:text-lg md:text-xl text-gray-600 max-w-xl mx-auto px-2">
          Share your calendar availability, receive meeting requests, and stay organized — all with Meeteazy.
        </p>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Link href="/signup">
            <span className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-full font-semibold shadow transition text-center">
              Get Started
            </span>
          </Link>
          <Link href="/signin">
            <span className="text-blue-600 font-semibold px-6 py-3 rounded-full border border-blue-600 hover:bg-blue-50 transition text-center">
              Sign In
            </span>
          </Link>
        </div>

        {/* Explanation */}
        <div className="pt-6 text-gray-700 text-sm sm:text-base px-4 text-left sm:text-center">
          <p><strong>How it works:</strong></p>
          <ul className="list-disc sm:list-none sm:px-0 px-5 mt-2 space-y-1">
            <li>📆 Set your weekly availability in your private dashboard</li>
            <li>🔗 Share your booking link with others (like <code>/u/yourname</code>)</li>
            <li>📩 Receive requests and approve or decline them</li>
            <li>📨 Automatic email confirmations + calendar invite included</li>
          </ul>
        </div>

        {/* Footer */}
        <footer className="pt-10 text-sm text-gray-400">
          &copy; {new Date().getFullYear()} Meeteazy. All rights reserved.
        </footer>
      </div>
    </main>
  )
}