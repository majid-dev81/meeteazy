'use client'

import { useState } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth, db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'
import { useRouter } from 'next/navigation'

export default function SigninPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showResend, setShowResend] = useState(false)
  const [resendMessage, setResendMessage] = useState('')

  const handleSignin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setShowResend(false)
    setResendMessage('')

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      const user = userCredential.user

      const userDoc = await getDoc(doc(db, 'users', email))
      const data = userDoc.data()

      if (!userDoc.exists() || !data?.verified) {
        setError('Your email is not verified yet.')
        setShowResend(true)
        return
      }

      await fetch('/api/set-cookie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verified: true }),
      })

      const hasUsername = !!data?.username
      router.push(hasUsername ? '/dashboard' : '/onboarding')
    } catch (err: any) {
      console.error(err)
      setError('Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setResendMessage('Sending...')
    try {
      const response = await fetch('/api/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const result = await response.json()
      setResendMessage(result?.success ? '✅ Verification email sent!' : '❌ Failed to resend email')
    } catch {
      setResendMessage('❌ Error sending email')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <form onSubmit={handleSignin} className="max-w-md w-full bg-white p-6 rounded shadow space-y-4">
        <h2 className="text-2xl font-bold text-center text-gray-800">Sign In</h2>

        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-4 py-2 border rounded"
        />

        <input
          type="password"
          required
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-4 py-2 border rounded"
        />

        {error && <p className="text-sm text-red-500">{error}</p>}

        {showResend && (
          <div className="text-sm text-blue-600">
            <button type="button" onClick={handleResend} className="underline font-medium">
              Resend verification email
            </button>
            {resendMessage && <p className="mt-1 text-gray-600">{resendMessage}</p>}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className={`w-full py-2 rounded text-white font-semibold ${loading ? 'bg-blue-300' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  )
}