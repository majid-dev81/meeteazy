'use client'

import Image from 'next/image'
import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-gray-100 flex flex-col items-center justify-center px-4 text-center">
      <div className="max-w-3xl w-full space-y-10">
        {/* Logo */}
        <div className="flex justify-center">
          <div className="relative w-28 h-28 sm:w-32 sm:h-32">
            <Image
              src="/logo.png"
              alt="Meeteazy logo"
              fill
              className="object-contain rounded-full shadow-lg border border-gray-200"
              priority
            />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-4xl md:text-5xl font-extrabold text-gray-800 leading-tight">
          Smart, Simple & Effortless Scheduling
        </h1>

        {/* Subheading */}
        <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto">
          Share your calendar availability, receive meeting requests, and stay organized — all with Meeteazy.
        </p>

        {/* Buttons */}
        <div className="flex flex-wrap justify-center gap-4">
          <Link href="/signup">
            <span className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-full font-semibold shadow transition">
              Get Started
            </span>
          </Link>

          <Link href="/signin">
            <span className="text-blue-600 font-semibold px-6 py-3 rounded-full border border-blue-600 hover:bg-blue-50 transition">
              Sign In
            </span>
          </Link>
        </div>

        {/* Footer */}
        <footer className="pt-10 text-sm text-gray-400">
          &copy; {new Date().getFullYear()} Meeteazy. All rights reserved.
        </footer>
      </div>
    </main>
  )
}