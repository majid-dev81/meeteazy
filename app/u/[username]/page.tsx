'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { db } from '@/lib/firebase'
import {
  collection,
  getDocs,
  query,
  where,
  addDoc,
  onSnapshot
} from 'firebase/firestore'

import resend from '@/lib/resend'
import Link from 'next/link'

const hours = Array.from({ length: 18 }, (_, i) => {
  const h = Math.floor(i / 2) + 9
  const m = i % 2 === 0 ? '00' : '30'
  return `${String(h).padStart(2, '0')}:${m}`
})

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const weekdayIndexMap: Record<string, number> = {
  Monday: 1, Tuesday: 2, Wednesday: 3,
  Thursday: 4, Friday: 5, Saturday: 6, Sunday: 0
}

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
  const [location, setLocation] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [bookedSlots, setBookedSlots] = useState<Record<string, string[]>>({})

  const now = new Date()
  const currentWeekday = now.getDay()
  const currentTime = now.getHours() * 60 + now.getMinutes()

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

      const bookingsRef = collection(db, 'users', email, 'bookings')
      onSnapshot(bookingsRef, (snapshot) => {
        const accepted = snapshot.docs
          .filter((b) => b.data().status === 'accepted')
          .map((b) => b.data())

        const grouped: Record<string, string[]> = {}
        accepted.forEach((item: any) => {
          if (!grouped[item.day]) grouped[item.day] = []
          grouped[item.day].push(item.time)
        })
        setBookedSlots(grouped)
      })
    }
    loadUser()
  }, [username])

  const handleRequest = async () => {
    if (!name || !email || !selectedDay || !selectedTime || !ownerEmail) return

    await addDoc(collection(db, 'users', ownerEmail, 'bookings'), {
      name,
      email,
      subject,
      location,
      day: selectedDay,
      time: selectedTime,
      status: 'pending',
      createdAt: new Date(),
    })

    await resend.emails.send({
      from: process.env.EMAIL_FROM!,
      to: ownerEmail,
      subject: 'New Booking Request on Meeteazy',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Hello ${ownerName},</h2>
          <p><strong>${name}</strong> (${email}) just requested a meeting with you.</p>
          <p><strong>Requested Time:</strong> ${selectedDay} at ${selectedTime}</p>
          ${subject ? `<p><strong>Subject:</strong> ${subject}</p>` : ''}
          ${location ? `<p><strong>Location:</strong> ${location}</p>` : ''}
          <p>Please visit your dashboard to accept or decline the request.</p>
          <p>– The Meeteazy Team · meeteazy.com</p>
        </div>
      `
    })

    setSubmitted(true)
  }

  const isSlotExpired = (day: string, time: string) => {
    const slotDayIndex = weekdayIndexMap[day]
    if (slotDayIndex !== currentWeekday) return false
    const [h, m] = time.split(':').map(Number)
    const slotMinutes = h * 60 + m
    return slotMinutes <= currentTime
  }

  return (
    <div className="p-4 space-y-6 max-w-3xl mx-auto">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Book with {username}</h1>
        <p className="text-gray-600">Each time slot is 30 minutes</p>
        <p className="text-sm text-gray-500 mt-2">
          Choose a time slot from the available options below, then enter your info to request a meeting.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {days.map((day) => (
          <div key={day}>
            <h3 className="font-semibold mb-2">{day}</h3>
            <div className="flex flex-wrap gap-1">
              {hours.map((time) => {
                const available = availability[day]?.includes(time)
                const alreadyBooked = bookedSlots[day]?.includes(time)
                const expired = isSlotExpired(day, time)
                const isAvailable = available && !alreadyBooked && !expired
                const isSelected = selectedDay === day && selectedTime === time

                return (
                  <button
                    key={time}
                    disabled={!isAvailable}
                    onClick={() => {
                      setSelectedDay(day)
                      setSelectedTime(time)
                    }}
                    className={`px-3 py-1 text-sm rounded border w-[80px] text-center ${
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
        <div className="mt-6 space-y-4 border rounded p-4">
          <h2 className="text-xl font-semibold">
            Request {selectedDay} at {selectedTime}
          </h2>
          {submitted ? (
            <div className="text-green-700 space-y-4">
              <p className="text-lg font-medium">✅ Your request has been sent!</p>
              <p>You’ll receive an email once your meeting is confirmed by {ownerName}.</p>
              <Link
                href="/"
                className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow"
              >
                Back to Home
              </Link>
            </div>
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
              <input
                type="text"
                placeholder="Location (e.g. Teams, Zoom, Office)"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-4 py-2 border rounded"
              />
              <button
                onClick={handleRequest}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 w-full"
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