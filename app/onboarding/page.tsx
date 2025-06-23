// app/onboarding/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db } from '@/lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import {
  doc,
  updateDoc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore'

export default function OnboardingPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/signup')
      } else {
        setEmail(user.email!)
        const userRef = doc(db, 'users', user.email!)
        const snap = await getDoc(userRef)
        if (snap.exists() && snap.data()?.username) {
          router.push('/dashboard')
        }
      }
    })
    return () => unsubscribe()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = username.trim().toLowerCase()

    if (!trimmed) {
      setError('Username is required')
      return
    }

    if (!/^[a-z0-9_]{3,}$/.test(trimmed)) {
      setError('Username must be at least 3 characters, one word, and only use letters, numbers, or underscores.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const q = query(collection(db, 'users'), where('username', '==', trimmed))
      const snapshot = await getDocs(q)

      if (!snapshot.empty) {
        setError('This username is already taken')
        setLoading(false)
        return
      }

      await updateDoc(doc(db, 'users', email), {
        username: trimmed,
      })

      router.push('/dashboard')
    } catch (err) {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <form onSubmit={handleSubmit} className="max-w-md w-full space-y-4 p-6 border rounded shadow">
        <h1 className="text-2xl font-bold text-center">Choose a Username</h1>

        <ul className="text-sm text-gray-600 list-disc list-inside">
          <li>Use only letters, numbers, or underscores</li>
          <li>No spaces or special characters</li>
          <li>Minimum 3 characters</li>
        </ul>

        <input
          type="text"
          placeholder="e.g. majid123"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full px-4 py-2 border rounded"
        />

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className={`w-full py-2 text-white rounded ${loading ? 'bg-green-300' : 'bg-green-600 hover:bg-green-700'}`}
        >
          {loading ? 'Saving...' : 'Continue'}
        </button>
      </form>
    </div>
  )
}