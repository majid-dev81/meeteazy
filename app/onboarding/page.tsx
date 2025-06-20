'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db } from '@/lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, updateDoc, getDoc } from 'firebase/firestore'

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
    if (!username.trim()) {
      setError('Username is required')
      return
    }
    setLoading(true)
    try {
      await updateDoc(doc(db, 'users', email), {
        username: username.trim(),
      })
      router.push('/dashboard')
    } catch (err: any) {
      setError('Failed to save username')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <form onSubmit={handleSubmit} className="max-w-md w-full space-y-4 p-6 border rounded shadow">
        <h1 className="text-2xl font-bold text-center">Choose a Username</h1>
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