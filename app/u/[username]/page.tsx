// only the changed or new lines are explained afterward 👇

'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { db } from '@/lib/firebase'
import {
  collection,
  getDocs,
  query,
  where,
  addDoc
} from 'firebase/firestore'

import resend from '@/lib/resend'

const hours = Array.from({ length: 18 }, (_, i) => {
  const h = Math.floor(i / 2) + 9
  const m = i % 2 === 0 ? '00' : '30'
  return `${String(h).padStart(2, '0')}:${m}`
})

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export default function PublicUserPage() {
  const { username } = useParams() as { username: string }

  const [availability, setAvailability] = useState<Record<string, string[]>>({})
  const [ownerEmail, setOwnerEmail] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [selectedDay, setSelectedDay] = useState('')
  const [selectedTime, setSelectedTime] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [bookedSlots, setBookedSlots] = useState<Record<string, string[]>>({})

  useEffect(() => {
    const loadUser = async () => {
      const q = query(collection(db, 'users'), where('username', '==', username))
      const snapshot = await getDocs(q)
      if (snapshot.empty) return

      const doc = snapshot.docs[0]
      setAvailability(doc.data().availability || {})
      const email = doc.id
      setOwnerEmail(email)
      setOwnerName(doc.data().username)

      const bookingsSnap = await getDocs(collection(db, 'users', email, 'bookings'))
      const accepted = bookingsSnap.docs
        .filter((b) => b.data().status === 'accepted')
        .map((b) => b.data())

      const grouped: Record<string, string[]> = {}
      accepted.forEach((item: any) => {
        if (!grouped[item.day]) grouped[item.day] = []
        grouped[item.day].push(item.time)
      })
      setBookedSlots(grouped)
    }
    loadUser()
  }, [username])

  const handleRequest = async () => {
    if (!name || !email || !selectedDay || !selectedTime || !ownerEmail) return

    await addDoc(collection(db, 'users', ownerEmail, 'bookings'), {
      name,
      email,
      subject,
      day: selectedDay,
      time: selectedTime,
      status: 'pending',
      createdAt: new Date(),
    })

    const formattedTime = `${selectedDay} at ${selectedTime}`
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Hello ${ownerName},</h2>
        <p><strong>${name}</strong> (${email}) just requested a meeting with you.</p>
        <p><strong>Requested Time:</strong> ${formattedTime}</p>
        <p><strong>Subject:</strong> ${subject || 'Not specified'}</p>
        <p>Please visit your dashboard to accept or decline the request.</p>
        <p>– The Meeteazy Team</p>
      </div>
    `

    await resend.emails.send({
      from: process.env.EMAIL_FROM!,
      to: ownerEmail,
      subject: 'New Booking Request on Meeteazy',
      html,
    })

    setSubmitted(true)
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Book with {username}</h1>
      <p className="text-gray-600">Each time slot is 30 minutes</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {days.map((day) => (
          <div key={day}>
            <h3 className="font-semibold mb-2">{day}</h3>
            <div className="flex flex-wrap gap-1">
              {hours.map((time) => {
                const available = availability[day]?.includes(time)
                const alreadyBooked = bookedSlots[day]?.includes(time)
                const isAvailable = available && !alreadyBooked
                const isSelected = selectedDay === day && selectedTime === time

                return (
                  <button
                    key={time}
                    disabled={!isAvailable}
                    onClick={() => {
                      setSelectedDay(day)
                      setSelectedTime(time)
                    }}
                    className={`px-2 py-1 text-sm rounded border ${
                      isSelected
                        ? 'bg-blue-600 text-white'
                        : isAvailable
                        ? 'bg-green-200 border-green-400'
                        : 'bg-gray-100 text-gray-400'
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

      {selectedDay && selectedTime && (
        <div className="mt-6 max-w-md space-y-4">
          <h2 className="text-xl font-semibold">
            Request {selectedDay} at {selectedTime}
          </h2>
          {submitted ? (
            <p className="text-green-600">✅ Request sent!</p>
          ) : (
            <>
              <input
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 border rounded"
              />
              <input
                type="email"
                placeholder="Your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border rounded"
              />
              <textarea
                placeholder="Subject of discussion"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-4 py-2 border rounded"
              ></textarea>
              <button
                onClick={handleRequest}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Send Request
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}