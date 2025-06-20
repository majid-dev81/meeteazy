'use client'

import Link from 'next/link'
import Image from 'next/image'

export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-gradient-to-br from-blue-50 to-white">
      <div className="max-w-xl w-full text-center space-y-6">
        <div className="flex justify-center">
          <Image src="/logo.png" alt="Meeteazy Logo" width={80} height={80} className="mx-auto" />
        </div>
        <h1 className="text-4xl font-bold text-gray-800">
          Welcome to <span className="text-blue-600">Meeteazy</span>
        </h1>
        <p className="text-gray-600 text-lg">
          Smart, simple, and fast scheduling. Set your availability, share your link, and let others book time with you.
        </p>

        <div className="flex justify-center gap-4">
          <Link href="/signup">
            <button className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Sign Up</button>
          </Link>
          <Link href="/signin">
            <button className="px-6 py-2 border border-blue-600 text-blue-600 rounded hover:bg-blue-50">Sign In</button>
          </Link>
        </div>

        <div className="pt-4">
          <p className="text-sm text-gray-400">© 2025 Meeteazy. All rights reserved.</p>
        </div>
      </div>
    </main>
  )
}