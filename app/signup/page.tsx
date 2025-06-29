'use client'

import { useState } from 'react'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { useRouter } from 'next/navigation'
import { auth, db } from '@/lib/firebase'
import { v4 as uuidv4 } from 'uuid'

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, password)

      // Generate a unique verification token
      const verificationToken = uuidv4()

      // Save user in Firestore with verificationToken and verified flag
      await setDoc(doc(db, 'users', userCred.user.email!), {
        username: '',
        verified: false,
        verificationToken,
      })

      // Send verification email using our custom API
      const response = await fetch('/api/send-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          token: verificationToken,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to send verification email')
      }

      // Redirect to custom verify page
      router.push('/verify')
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <form onSubmit={handleSignup} className="max-w-md w-full bg-white p-6 rounded shadow space-y-4">
        <h2 className="text-2xl font-bold text-center text-gray-800">Sign Up</h2>

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

        <button
          type="submit"
          disabled={loading}
          className={`w-full py-2 rounded text-white font-semibold ${loading ? 'bg-blue-300' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          {loading ? 'Creating Account...' : 'Create Account'}
        </button>
      </form>
    </div>
  )
}