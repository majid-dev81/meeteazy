'use client'

import { useState } from 'react'
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { useRouter } from 'next/navigation'
import { auth, db } from '@/lib/firebase'

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

      // Send email verification
      await sendEmailVerification(userCred.user)

      // Save blank user doc (we’ll update it after username is set)
      await setDoc(doc(db, 'users', userCred.user.email!), {
        username: ''
      })

      // Redirect to verify screen
      router.push('/verify')
    } catch (err: any) {
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