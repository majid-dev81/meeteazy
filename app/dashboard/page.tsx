'use client'

import { useEffect, useState } from 'react'
import { auth, db } from '@/lib/firebase'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  updateDoc,
} from 'firebase/firestore'
import { useRouter } from 'next/navigation'
import resend from '@/lib/resend'

const hours = Array.from({ length: 18 }, (_, i) => {
  const h = Math.floor(i / 2) + 9
  const m = i % 2 === 0 ? '00' : '30'
  return `${String(h).padStart(2, '0')}:${m}`
})

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export default function DashboardPage() {
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [availability, setAvailability] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [requests, setRequests] = useState<any[]>([])
  const [filter, setFilter] = useState<'all' | 'pending' | 'accepted' | 'declined'>('all')
  const [copied, setCopied] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user?.email) {
        setEmail(user.email)
        const ref = doc(db, 'users', user.email)
        const snap = await getDoc(ref)
        const data = snap.data()
        setUsername(data?.username || '')
        setAvailability(data?.availability || {})

        const bookingSnap = await getDocs(collection(db, 'users', user.email, 'bookings'))
        const all = bookingSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        setRequests(all)

        setLoading(false)
      }
    })
    return () => unsubscribe()
  }, [])

  const toggleSlot = (day: string, time: string) => {
    setAvailability((prev) => {
      const daySlots = prev[day] || []
      const updated = daySlots.includes(time)
        ? daySlots.filter((t) => t !== time)
        : [...daySlots, time]
      return { ...prev, [day]: updated }
    })
  }

  const saveAvailability = async () => {
    if (!email) return
    setSaving(true)
    setSaved(false)
    try {
      const ref = doc(db, 'users', email)
      await setDoc(ref, { availability }, { merge: true })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      console.error('Failed to save availability', e)
    } finally {
      setSaving(false)
    }
  }

  const handleStatusUpdate = async (id: string, status: 'accepted' | 'declined') => {
    console.log('📩 handleStatusUpdate called for:', id, status)

    try {
      const ref = doc(db, 'users', email, 'bookings', id)
      await updateDoc(ref, { status })
      console.log('✅ Firestore status updated')

      setRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status } : r))
      )

      const docSnap = await getDoc(ref)
      const data = docSnap.data()
      if (!data) {
        console.warn('⚠️ No booking data found for ID:', id)
        return
      }

      console.log('📬 Preparing to send email to:', data.email)

      const html = `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Hello ${data.name},</h2>
          <p>Your booking request for <strong>${data.day} at ${data.time}</strong> has been <strong>${status}</strong>.</p>
          ${data.subject ? `<p><strong>Subject:</strong> ${data.subject}</p>` : ''}
          <p>Thanks for using Meeteazy!</p>
        </div>
      `

      const result = await resend.emails.send({
        from: process.env.EMAIL_FROM!,
        to: data.email,
        subject: `Your booking was ${status}`,
        html,
      })

      console.log('📬 Email send result:', result)
    } catch (e) {
      console.error('❌ Failed to update booking status or send email:', e)
    }
  }

  const handleSignOut = async () => {
    await signOut(auth)
    router.push('/signin')
  }

  const filteredRequests = filter === 'all' ? requests : requests.filter(r => r.status === filter)
  const publicLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/u/${username}`

  const handleCopy = () => {
    navigator.clipboard.writeText(publicLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return <p className="p-4">Loading...</p>

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Hello, {username}</h1>
          <p className="text-gray-600">Email: {email}</p>
        </div>
        <button
          onClick={handleSignOut}
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
        >
          Sign Out
        </button>
      </div>

      <div className="flex items-center gap-2">
        <p className="text-gray-600">Public profile:</p>
        <input
          type="text"
          value={publicLink}
          readOnly
          className="border rounded px-2 py-1 text-sm w-full max-w-xs"
        />
        <button onClick={handleCopy} className="text-blue-600 text-sm underline">
          {copied ? '✅ Copied!' : 'Copy'}
        </button>
      </div>

      <h2 className="text-lg font-semibold mt-6">Weekly Availability</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {days.map((day) => (
          <div key={day}>
            <h3 className="font-semibold mb-2">{day}</h3>
            <div className="flex flex-wrap gap-1">
              {hours.map((time) => {
                const active = availability[day]?.includes(time)
                return (
                  <button
                    key={time}
                    onClick={() => toggleSlot(day, time)}
                    className={`px-2 py-1 text-sm rounded border ${
                      active ? 'bg-blue-600 text-white' : 'bg-gray-100'
                    }`}
                  >
                    {time}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={saveAvailability}
        disabled={saving}
        className="mt-4 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
      >
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
      {saved && <p className="text-green-600 mt-2">✅ Availability saved!</p>}

      <h2 className="text-lg font-semibold mt-8">Booking Requests</h2>

      <div className="space-x-2">
        {['all', 'pending', 'accepted', 'declined'].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status as any)}
            className={`px-3 py-1 rounded border ${
              filter === status
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 border-gray-300'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {filteredRequests.length === 0 && <p className="text-gray-500">No requests.</p>}

      <ul className="space-y-4">
        {filteredRequests.map((req) => (
          <li key={req.id} className="border rounded p-4">
            <p className="font-semibold">
              {req.name} ({req.email})
            </p>
            <p>
              {req.day} at {req.time}
            </p>
            {req.subject && <p>Subject: {req.subject}</p>}
            <p>
              Status: <span className="font-medium capitalize">{req.status}</span>
            </p>
            {req.status === 'pending' && (
              <div className="mt-2 space-x-2">
                <button
                  onClick={() => {
                    console.log('✅ Accept clicked for', req.id)
                    handleStatusUpdate(req.id, 'accepted')
                  }}
                  className="bg-blue-600 text-white px-3 py-1 rounded"
                >
                  Accept
                </button>
                <button
                  onClick={() => {
                    console.log('❌ Decline clicked for', req.id)
                    handleStatusUpdate(req.id, 'declined')
                  }}
                  className="bg-gray-400 text-white px-3 py-1 rounded"
                >
                  Decline
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}