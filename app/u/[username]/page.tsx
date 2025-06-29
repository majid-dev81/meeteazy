// app/u/[username]/page.tsx

'use client'

import { useEffect, useState, useMemo, FormEvent } from 'react'
import { useParams } from 'next/navigation'
import { db } from '@/lib/firebase'
import { collection, getDocs, query, where, addDoc, onSnapshot, doc } from 'firebase/firestore'
import { addDays, format, parse, isBefore, addMinutes, isValid } from 'date-fns'
import { clsx } from 'clsx'
import {
  User,
  Mail,
  Briefcase,
  Building2,
  Calendar,
  Clock,
  MapPin,
  ChevronDown,
  Phone,
  BookType,
} from 'lucide-react'

// --- Type Definitions ---
interface ProfileInfo {
  email: string
  username: string
  name?: string
  role?: string
  company?: string
  showContact?: boolean
}

interface TimeRange {
  start: string
  end: string
  interval: number
}

interface Availability {
  [dayKey: string]: TimeRange[]
}

interface Booking {
  date: string
  time: string
  duration: number
  status: 'pending' | 'accepted' | 'declined'
}

interface SelectedSlot {
  date: string
  time: string
  maxDuration: number
}

// --- Constants ---
const DURATION_OPTIONS = [15, 30, 45, 60]

// --- Helper Components ---
const ProfileCard = ({ profile }: { profile: ProfileInfo | null }) => {
  if (!profile) return null

  const Avatar = ({ name }: { name: string }) => (
    <div className="w-24 h-24 rounded-full bg-slate-200 flex items-center justify-center border-4 border-white shadow-md">
      <span className="text-4xl font-bold text-slate-500">{name?.charAt(0).toUpperCase()}</span>
    </div>
  )

  return (
    <div className="lg:sticky lg:top-8 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
      <div className="flex flex-col items-center text-center">
        <Avatar name={profile.name || profile.username} />
        <h1 className="text-2xl font-bold text-slate-800 mt-4">{profile.name || profile.username}</h1>
        {(profile.role || profile.company) && (
          <p className="text-md text-slate-500 mt-1 flex items-center gap-2">
            <Briefcase size={14} />
            {profile.role}{profile.role && profile.company && ' at '}{profile.company}
          </p>
        )}
      </div>
      <div className="mt-6 border-t border-slate-200 pt-6">
        <h3 className="font-semibold text-slate-700 text-sm uppercase tracking-wider">Details</h3>
        <ul className="mt-3 space-y-3 text-sm">
          {profile.showContact && (
            <li className="flex items-center gap-3">
              <Mail size={16} className="text-slate-400" />
              <a href={`mailto:${profile.email}`} className="text-blue-600 hover:underline">{profile.email}</a>
            </li>
          )}
          <li className="flex items-center gap-3">
            <Building2 size={16} className="text-slate-400" />
            <span>Schedule a meeting below.</span>
          </li>
        </ul>
      </div>
    </div>
  )
}


export default function PublicUserPage() {
  const { username } = useParams() as { username: string }

  const [profile, setProfile] = useState<ProfileInfo | null>(null)
  const [availability, setAvailability] = useState<Availability>({})
  const [acceptedBookings, setAcceptedBookings] = useState<Booking[]>([]); // Correctly store accepted bookings
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null)
  const [selectedDuration, setSelectedDuration] = useState<number>(DURATION_OPTIONS[1])
  const [availableDurations, setAvailableDurations] = useState<number[]>([])

  // Form state
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [phone, setPhone] = useState('')
  const [location, setLocation] = useState('')

  // UI state
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  const upcomingDays = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(new Date(), i)), [])

  useEffect(() => {
    if (!username) return

    const fetchUserData = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const usersRef = collection(db, 'users')
        const q = query(usersRef, where('username', '==', username))
        const userSnapshot = await getDocs(q)
        if (userSnapshot.empty) {
          setError('This user does not exist.'); setIsLoading(false); return;
        }
        const userDoc = userSnapshot.docs[0]; const userEmail = userDoc.id; const userData = userDoc.data()
        setProfile({
          email: userEmail, username: userData.username, name: userData.name,
          role: userData.role, company: userData.company, showContact: userData.showContact,
        })

        // Fetch availability from the user's document
        const availabilityUnsubscribe = onSnapshot(doc(db, 'users', userEmail), (docSnap) => {
          if (docSnap.data()?.availability) {
            setAvailability(docSnap.data()?.availability)
          }
        });

        // Listen for real-time updates on bookings to filter available slots
        const bookingsUnsubscribe = onSnapshot(collection(db, 'users', userEmail, 'bookings'), (snapshot) => {
          const currentAcceptedBookings = snapshot.docs
              .filter(d => d.data().status === 'accepted')
              .map(d => d.data() as Booking);
          setAcceptedBookings(currentAcceptedBookings);
        });
        
        setIsLoading(false)
        return () => { availabilityUnsubscribe(); bookingsUnsubscribe() }
      } catch (err) {
        console.error('Failed to fetch user data:', err)
        setError('An unexpected error occurred.')
        setIsLoading(false)
      }
    }
    fetchUserData()
  }, [username])

  const generateTimeSlots = (startStr: string, endStr: string, interval: number): string[] => {
    const slots: string[] = []; let current = parse(startStr, 'HH:mm', new Date()); const end = parse(endStr, 'HH:mm', new Date());
    if (!isValid(current) || !isValid(end)) return []
    while (isBefore(current, end)) { slots.push(format(current, 'HH:mm')); current = addMinutes(current, interval); }
    return slots
  }

  const handleSelectTime = (dateKey: string, time: string, maxDuration: number) => {
    setSelectedSlot({ date: dateKey, time, maxDuration })
    setShowSuccess(false)
    const allowed = DURATION_OPTIONS.filter(d => d <= maxDuration)
    setAvailableDurations(allowed)
    if (!allowed.includes(selectedDuration)) setSelectedDuration(allowed[0] || DURATION_OPTIONS[1])
  }

  const handleRequestMeeting = async (e: FormEvent) => {
    e.preventDefault()
    if (!profile || !selectedSlot || !name || !email) { alert('Please fill out all required fields.'); return }
    setIsSubmitting(true)
    try {
      await addDoc(collection(db, 'users', profile.email, 'bookings'), {
        name, email, phone, subject, location,
        date: selectedSlot.date, time: selectedSlot.time, duration: selectedDuration,
        status: 'pending', createdAt: new Date(),
      })
      await fetch('/api/send-booking-request', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: profile.email, from: 'noreply@meeteazy.com', ownerName: profile.name || profile.username,
          requesterName: name, requesterEmail: email, requesterPhone: phone,
          requesterLocation: location,
          subject, date: selectedSlot.date, time: selectedSlot.time, duration: selectedDuration,
        }),
      })
      setShowSuccess(true); setSelectedSlot(null); setName(''); setEmail(''); setPhone(''); setSubject(''); setLocation('');
    } catch (err) { console.error('Booking request failed:', err); alert('Failed to send your request.') }
    finally { setIsSubmitting(false) }
  }

  if (isLoading) return <div className="flex justify-center items-center h-screen bg-slate-50"><p>Loading availability...</p></div>
  if (error) return <div className="flex justify-center items-center h-screen bg-slate-50 text-red-600"><p>{error}</p></div>

  return (
    <div className="bg-slate-50 min-h-screen">
      <main className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 lg:gap-12">
          <div className="lg:col-span-1 mb-8 lg:mb-0">
            <ProfileCard profile={profile} />
          </div>

          <div className="lg:col-span-2">
            {showSuccess && !selectedSlot && (
              <div className="bg-green-50 border border-green-200 text-green-800 rounded-xl p-4 text-center mb-6">
                <p className="font-semibold">✅ Your request has been sent!</p>
                <p>You’ll receive a confirmation email once {profile?.name || profile?.username} accepts.</p>
              </div>
            )}
            
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Select a Date & Time</h2>
            <p className="text-slate-500 mb-6">Pick an available slot below to proceed with your booking request.</p>

            <div className="space-y-6">
              {upcomingDays.map(date => {
                const dayKey = format(date, 'yyyy-MM-dd')
                const dayAvailability = availability[dayKey] || []

                // Correctly filter out booked slots
                const blockedSlots = new Set<string>();
                acceptedBookings
                  .filter(b => b.date === dayKey)
                  .forEach(booking => {
                    let current = parse(booking.time, "HH:mm", new Date());
                    const end = addMinutes(current, booking.duration);
                    while (isBefore(current, end)) {
                      blockedSlots.add(format(current, "HH:mm"));
                      // Using a 15-minute interval as the smallest unit to block time effectively
                      current = addMinutes(current, 15);
                    }
                  });

                const availableSlots = dayAvailability.flatMap(range => 
                    generateTimeSlots(range.start, range.end, range.interval)
                      .filter(time => !blockedSlots.has(time))
                      .map(time => ({ time, maxDuration: range.interval }))
                );
                
                if (availableSlots.length === 0) return null

                return (
                  <div key={dayKey} className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm">
                    <h3 className="font-semibold text-lg text-slate-700 mb-4 flex items-center gap-2">
                      <Calendar size={18} />
                      {format(date, 'EEEE, MMMM d')}
                    </h3>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                      {availableSlots.map(({ time, maxDuration }) => (
                        <button key={time} onClick={() => handleSelectTime(dayKey, time, maxDuration)}
                          className={clsx('px-3 py-2 rounded-lg border text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500',
                            selectedSlot?.date === dayKey && selectedSlot?.time === time
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-slate-100 hover:bg-blue-50 text-slate-800 border-slate-200'
                          )}>{format(parse(time, 'HH:mm', new Date()), 'h:mm a')}</button>
                      ))}
                    </div>

                    {selectedSlot?.date === dayKey && (
                      <div className="mt-6 border-t border-slate-200 pt-6">
                        <h3 className="text-lg font-bold text-slate-800 text-center mb-1">Enter Details</h3>
                        <p className="text-center text-slate-500 mb-6">Confirming for <span className="text-slate-900 font-semibold">{format(parse(selectedSlot.time, 'HH:mm', new Date()), 'h:mm a')}</span> on <span className="text-slate-900 font-semibold">{format(date, 'MMM d')}</span>.</p>
                        <form onSubmit={handleRequestMeeting} className="max-w-lg mx-auto space-y-4">
                          {[
                              { id: 'duration', label: 'Duration', type: 'select', icon: <Clock size={16} /> },
                              { id: 'name', label: 'Your Name', type: 'text', placeholder: 'John Doe', state: name, setState: setName, icon: <User size={16} />, required: true },
                              { id: 'email', label: 'Your Email', type: 'email', placeholder: 'you@example.com', state: email, setState: setEmail, icon: <Mail size={16} />, required: true },
                              { id: 'phone', label: 'Phone Number (Optional)', type: 'tel', placeholder: '+1 555-123-4567', state: phone, setState: setPhone, icon: <Phone size={16} /> },
                              { id: 'location', label: 'Location (Optional)', type: 'text', placeholder: 'e.g., Zoom, Office, Cafe', state: location, setState: setLocation, icon: <MapPin size={16} /> },
                              { id: 'subject', label: 'Subject (Optional)', type: 'textarea', placeholder: 'Briefly describe the topic...', state: subject, setState: setSubject, icon: <BookType size={16} /> },
                          ].map(f => (
                            <div key={f.id}>
                                <label htmlFor={f.id} className="block text-sm font-medium text-slate-700 mb-1">{f.label}</label>
                                <div className="relative">
                                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">{f.icon}</span>
                                    {f.type === 'select' ? (
                                        <select id="duration" value={selectedDuration} onChange={e => setSelectedDuration(parseInt(e.target.value))} className="pl-10 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                                            {availableDurations.map(d => (<option key={d} value={d}>{d} min</option>))}
                                        </select>
                                    ) : f.type === 'textarea' ? (
                                         <textarea id={f.id} placeholder={f.placeholder} value={f.state} onChange={e => f.setState?.(e.target.value)} rows={3} className="pl-10 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                                    ) : (
                                         <input id={f.id} type={f.type} placeholder={f.placeholder} value={f.state} onChange={e => f.setState?.(e.target.value)} required={f.required} className="pl-10 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                                    )}
                                </div>
                            </div>
                          ))}
                          <button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 text-white px-4 py-2.5 rounded-lg font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors">
                            {isSubmitting ? 'Sending Request...' : 'Send Request'}
                          </button>
                        </form>
                      </div>
                    )}
                  </div>
                )
              })}
               {!isLoading && !upcomingDays.some(date => (availability[format(date, 'yyyy-MM-dd')] || []).length > 0) && (
                 <div className="text-center bg-white rounded-xl p-8 border border-slate-200">
                    <h3 className="text-lg font-semibold text-slate-700">No available times</h3>
                    <p className="text-slate-500 mt-1">{profile?.name || profile?.username} has no availability in the next 14 days.</p>
                </div>
               )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}