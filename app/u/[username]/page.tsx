// /app/u/[username]/page.tsx

'use client'

import React, { useEffect, useState, useMemo, FormEvent } from 'react'
import { useParams } from 'next/navigation'
import { db } from '@/lib/firebase'
// ✅ FIX: Import serverTimestamp for accurate creation time
import { collection, getDocs, query, where, addDoc, onSnapshot, doc, serverTimestamp } from 'firebase/firestore'
import { addDays, format, parse, isBefore, addMinutes, isValid } from 'date-fns'
import { clsx } from 'clsx'
import {
  User,
  Mail,
  Briefcase,
  Calendar,
  Clock,
  MapPin,
  Phone,
  BookType,
  Building,
  Linkedin,
  Twitter,
  Globe,
  Info,
  Target,
  Send,
  CheckCircle2,
} from 'lucide-react'

// --- Type Definitions ---
interface ProfileInfo {
  email: string
  username: string
  name?: string
  role?: string
  company?: string
  photoUrl?: string
  bio?: string
  focus?: string
  linkedin?: string
  twitter?: string
  website?: string
  whatsapp?: string
  bannerUrl?: string
  mapEmbedUrl?: string
  showContact?: boolean
  availability?: Availability 
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
const UPCOMING_DAYS_COUNT = 30

/**
 * Ensures a URL is properly formatted for external linking.
 */
const formatUrl = (url: string): string => {
  if (!url) return '#';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return `https://${url}`;
};

// --- Helper Components ---
const ProfileSection = ({ profile, username, isAvailableToday }: { profile: ProfileInfo | null; username: string; isAvailableToday: boolean }) => {
  if (!profile) return null;

  const hasSocials = profile.linkedin || profile.twitter || profile.website || profile.whatsapp;
  const hasContactInfo = profile.showContact && profile.email;

  const Avatar = ({ name, imageUrl }: { name: string; imageUrl?: string }) => (
    <div className="w-28 h-28 md:w-32 md:h-32 rounded-full bg-gray-200 flex items-center justify-center border-4 border-white shadow-lg mx-auto overflow-hidden">
      {imageUrl ? (
        <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
      ) : (
        <span className="text-5xl font-bold text-gray-500">{name?.charAt(0).toUpperCase()}</span>
      )}
    </div>
  );

  const SectionBlock = ({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) => (
    <div className="border-t border-gray-200/80 pt-5 mt-5 text-left">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2 mb-3">
        {icon} {title}
      </h3>
      <div className="text-sm text-gray-700 space-y-2">{children}</div>
    </div>
  );

  const SocialButton = ({ href, icon, label, bgColorClass }: { href: string; icon: React.ReactNode; label: string; bgColorClass: string; }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className={clsx("flex items-center justify-center w-full gap-3 px-4 py-3 rounded-lg font-semibold text-white transition-transform hover:scale-105 shadow-sm", bgColorClass)}>
      {icon} {label}
    </a>
  );

  return (
    <aside className="lg:sticky lg:top-8 space-y-8">
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-lg relative text-center">
        <div className="h-32 bg-sky-200 rounded-xl overflow-hidden -m-6 mb-0">
          {profile.bannerUrl && (
            <img src={profile.bannerUrl} alt={`${profile.name}'s banner`} className="w-full h-full object-cover" />
          )}
        </div>
        <div className={clsx("flex flex-col items-center", "pt-4 -mt-16")}>
          <Avatar name={profile.name || profile.username} imageUrl={profile.photoUrl} />
          <h1 className="text-3xl font-bold text-gray-800 mt-4">{profile.name || profile.username}</h1>
          {(profile.role || profile.company) && (
            <p className="text-md text-gray-600 mt-2 flex items-center justify-center gap-1.5 flex-wrap px-4">
              <Briefcase size={14} className="shrink-0 text-gray-500" />
              <span>
                {profile.role}{profile.role && profile.company && ' at '}{profile.company}
              </span>
            </p>
          )}
        </div>
        
        {isAvailableToday && (
          <div className="mt-6 border-t border-gray-200 pt-5">
            <div className="bg-teal-50 text-teal-900 rounded-lg p-3 text-sm text-center flex items-center justify-center gap-2 font-semibold">
              <Clock size={16} />
              <span>Available for meetings today!</span>
            </div>
          </div>
        )}

        {hasSocials && (
          <div className="mt-6 pt-6 border-t border-gray-200 space-y-3">
             {profile.linkedin && <SocialButton href={formatUrl(profile.linkedin)} label="Connect on LinkedIn" icon={<Linkedin size={20} />} bgColorClass="bg-[#0077B5] hover:bg-[#00669c]" />}
             {profile.whatsapp && <SocialButton href={`https://wa.me/${profile.whatsapp.replace(/\D/g, '')}`} label="Chat on WhatsApp" icon={<Phone size={20} />} bgColorClass="bg-[#25D366] hover:bg-[#1ebe58]" />}
             {profile.twitter && <SocialButton href={formatUrl(profile.twitter)} label="Follow on X (Twitter)" icon={<Twitter size={20} />} bgColorClass="bg-[#1DA1F2] hover:bg-[#1a91da]" />}
             {profile.website && <SocialButton href={formatUrl(profile.website)} label="Visit My Website" icon={<Globe size={20} />} bgColorClass="bg-gray-700 hover:bg-gray-800" />}
          </div>
        )}

        <div className="text-left">
          {profile.focus && (
            <SectionBlock icon={<Target size={14} className="text-gray-400" />} title="Looking For">
              <p className="whitespace-pre-wrap">{profile.focus}</p>
            </SectionBlock>
          )}
          
          {profile.bio && (
            <SectionBlock icon={<Info size={14} className="text-gray-400" />} title="About Me">
              <p className="whitespace-pre-wrap">{profile.bio}</p>
            </SectionBlock>
          )}
          
          {hasContactInfo && (
            <SectionBlock icon={<User size={14} className="text-gray-400" />} title="Contact">
               <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <Mail size={16} className="text-gray-400 shrink-0 mt-0.5" />
                    <a href={`mailto:${profile.email}`} className="text-sky-600 hover:underline break-all">{profile.email}</a>
                  </li>
              </ul>
            </SectionBlock>
          )}
        </div>
      </div>

      {profile.mapEmbedUrl && (
        <div className="bg-white p-2 rounded-2xl border border-gray-200 shadow-lg">
           <div className="aspect-w-16 aspect-h-9 rounded-xl overflow-hidden">
             <div key={profile.mapEmbedUrl} dangerouslySetInnerHTML={{ __html: profile.mapEmbedUrl }} />
           </div>
        </div>
      )}
    </aside>
  );
}


export default function PublicUserPage() {
  const params = useParams()
  const username = params.username as string

  const [profile, setProfile] = useState<ProfileInfo | null>(null)
  const [profileId, setProfileId] = useState<string | null>(null);
  const [availability, setAvailability] = useState<Availability>({})
  const [acceptedBookings, setAcceptedBookings] = useState<Booking[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null)
  const [selectedDuration, setSelectedDuration] = useState<number>(DURATION_OPTIONS[1])
  const [availableDurations, setAvailableDurations] = useState<number[]>([])

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [phone, setPhone] = useState('')
  const [location, setLocation] = useState('')

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  const upcomingDays = useMemo(() => Array.from({ length: UPCOMING_DAYS_COUNT }, (_, i) => addDays(new Date(), i)), [])
  const todayKey = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

  useEffect(() => {
    if (!username) {
        setIsLoading(false);
        setError('No username provided.');
        return;
    }

    setIsLoading(true);

    const usersRef = collection(db, 'users');
    const profileQuery = query(usersRef, where('username', '==', username));
    
    let unsubscribeUserDoc: () => void;
    let unsubscribeBookings: () => void;

    const fetchUserData = async () => {
        try {
            const querySnapshot = await getDocs(profileQuery);
            if (querySnapshot.empty) {
                setError('This user does not exist.');
                setProfile(null);
                setIsLoading(false);
                return;
            }
            
            const userDoc = querySnapshot.docs[0];
            const userId = userDoc.id; // This is the owner's email
            
            setProfileId(userId);
            
            const userDocRef = doc(db, 'users', userId);
            unsubscribeUserDoc = onSnapshot(userDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data() as ProfileInfo;
                    
                    const profileWithEmail = {
                        ...data,
                        email: userId 
                    };
                    
                    setProfile(profileWithEmail); 
                    setAvailability(data.availability || {});
                    setError(null);
                } else {
                    setError('This user no longer exists.');
                    setProfile(null);
                    setAvailability({});
                }
            });

            const bookingsRef = collection(db, 'users', userId, 'bookings');
            const acceptedQuery = query(bookingsRef, where('status', '==', 'accepted'));
            unsubscribeBookings = onSnapshot(acceptedQuery, (snapshot) => {
                const newBookings = snapshot.docs.map(doc => doc.data() as Booking);
                setAcceptedBookings(newBookings);
            }, (err) => {
                console.error("Error fetching bookings:", err);
                setError('Failed to load bookings.');
            });

        } catch (e) {
            console.error("Error fetching user data: ", e);
            setError('Failed to load profile.');
        } finally {
            setIsLoading(false);
        }
    };

    fetchUserData();

    return () => {
        if (unsubscribeUserDoc) unsubscribeUserDoc();
        if (unsubscribeBookings) unsubscribeBookings();
    };
  }, [username]);


  const generateTimeSlots = (startStr: string, endStr: string, interval: number): string[] => {
    const slots: string[] = []; let current = parse(startStr, 'HH:mm', new Date()); const end = parse(endStr, 'HH:mm', new Date());
    if (!isValid(current) || !isValid(end)) return []
    while (isBefore(current, end)) { slots.push(format(current, 'HH:mm')); current = addMinutes(current, interval); }
    return slots
  }
  
  const isAvailableToday = useMemo(() => {
    if (isLoading || !availability[todayKey]) return false;
    const dayAvailability = availability[todayKey] || [];

    const blockedSlots = new Set<string>();
    acceptedBookings.filter(b => b.date === todayKey).forEach(booking => {
      let current = parse(booking.time, "HH:mm", new Date());
      if (!isValid(current)) return;
      const end = addMinutes(current, booking.duration);
      while (isBefore(current, end)) {
        blockedSlots.add(format(current, "HH:mm"));
        current = addMinutes(current, 15);
      }
    });
      
    const availableTodaySlots = dayAvailability.flatMap(range => 
        generateTimeSlots(range.start, range.end, range.interval).filter(time => !blockedSlots.has(time))
    );
    return availableTodaySlots.length > 0;
  }, [isLoading, availability, acceptedBookings, todayKey]);


  const handleSelectTime = (dateKey: string, time: string, maxDuration: number) => {
    setSelectedSlot({ date: dateKey, time, maxDuration })
    setShowSuccess(false)
    const allowed = DURATION_OPTIONS.filter(d => d <= maxDuration)
    setAvailableDurations(allowed)
    if (!allowed.includes(selectedDuration)) setSelectedDuration(allowed[0] || DURATION_OPTIONS[1])
  }

  const handleRequestMeeting = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile || !profileId || !selectedSlot || !name || !email) {
      setError('Please fill out all required fields and select a time slot.');
      return;
    }
    setIsSubmitting(true);
    setError(null);

    try {
      // 1. Prepare booking data for Firestore
      const newBookingData = {
        date: selectedSlot.date,
        time: selectedSlot.time,
        duration: selectedDuration,
        status: 'pending' as const,
        createdAt: serverTimestamp(),
        requesterName: name,
        requesterEmail: email,
        requesterPhone: phone,
        location: location,
        subject: subject || `Meeting request from ${name}`,
      };

      // 2. Save booking to Firestore
      const bookingsCollectionRef = collection(db, 'users', profileId, 'bookings');
      await addDoc(bookingsCollectionRef, newBookingData);

      // 3. Prepare email payload. `profile.email` is guaranteed to be the owner's email.
      const emailPayload = {
        ownerEmail: profile.email,
        ownerName: profile.name || profile.username,
        requesterName: name,
        requesterEmail: email,
        requesterPhone: phone,
        subject: newBookingData.subject,
        date: selectedSlot.date,
        time: selectedSlot.time,
        duration: selectedDuration,
        location: location,
      };

      // 4. ✅ UPDATE: Call the NEW API route for sending the booking request email
      const emailResponse = await fetch('/api/new-booking-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailPayload),
      });

      if (!emailResponse.ok) {
        // The booking is saved, so we don't show a hard error to the user.
        // We log it for debugging.
        const emailResult = await emailResponse.json();
        console.error('API Error: Failed to send booking request email:', emailResult.details);
      } else {
        console.log('✅ Booking request email sent successfully.');
      }

      // 5. Reset form and show success message
      setShowSuccess(true);
      setSelectedSlot(null);
      setName('');
      setEmail('');
      setPhone('');
      setSubject('');
      setLocation('');

    } catch (err) {
      console.error('Failed to submit booking request:', err);
      setError('Could not submit your booking request. Please try again later.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (isLoading) return <div className="flex justify-center items-center h-screen bg-gray-50"><p>Loading availability...</p></div>
  if (error) return <div className="flex justify-center items-center h-screen bg-gray-50 text-red-600"><p>{error}</p></div>
  if (!profile) return <div className="flex justify-center items-center h-screen bg-gray-50"><p>Profile not found.</p></div>


  return (
    <div className="bg-gray-50 min-h-screen font-sans">
      <main className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 lg:gap-12">
          
          <ProfileSection profile={profile} username={username} isAvailableToday={isAvailableToday} />

          <div className="lg:col-span-2 mt-8 lg:mt-0">
            {showSuccess && !selectedSlot && (
              <div className="bg-teal-50 border-l-4 border-teal-500 text-teal-900 rounded-lg p-4 mb-6 flex items-center gap-3" role="alert">
                <CheckCircle2 size={24} />
                <div>
                    <p className="font-bold">Your request has been sent!</p>
                    <p>You'll get an email once {profile?.name || profile?.username} accepts.</p>
                </div>
              </div>
            )}
            
            <div className="mb-8">
                <h2 className="text-4xl font-bold text-gray-800 tracking-tight">Request a Meeting</h2>
                <p className="text-gray-500 mt-2 text-lg">Select an available time slot below to book a meeting.</p>
            </div>

            <div className="space-y-6">
              {upcomingDays.map(date => {
                const dayKey = format(date, 'yyyy-MM-dd');
                const dayAvailability = availability[dayKey] || [];

                const blockedSlots = new Set<string>();
                acceptedBookings.filter(b => b.date === dayKey).forEach(booking => {
                    let current = parse(booking.time, "HH:mm", new Date());
                    if (!isValid(current)) return;
                    const end = addMinutes(current, booking.duration);
                    while (isBefore(current, end)) {
                      blockedSlots.add(format(current, "HH:mm"));
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
                  <div key={dayKey} className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 shadow-lg">
                    <h3 className="font-semibold text-xl text-gray-800 mb-4 flex items-center gap-3">
                      <Calendar size={20} className="text-sky-500" />
                      {format(date, 'EEEE, MMMM d')}
                    </h3>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                      {availableSlots.map(({ time, maxDuration }) => (
                        <button key={time} onClick={() => handleSelectTime(dayKey, time, maxDuration)}
                          className={clsx('px-3 py-2.5 rounded-lg border text-sm font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500',
                            selectedSlot?.date === dayKey && selectedSlot?.time === time
                              ? 'bg-sky-600 text-white border-sky-600 shadow-md transform scale-105'
                              : 'bg-white hover:bg-sky-50 text-gray-700 border-gray-300 hover:border-sky-400'
                          )}>{format(parse(time, 'HH:mm', new Date()), 'h:mm a')}</button>
                      ))}
                    </div>

                    {selectedSlot?.date === dayKey && (
                      <div className="mt-6 border-t border-gray-200 pt-6">
                        <h3 className="text-xl font-bold text-gray-800 text-center mb-1">Enter Details</h3>
                        <p className="text-center text-gray-500 mb-6">Confirming for <span className="text-gray-900 font-semibold">{format(parse(selectedSlot.time, 'HH:mm', new Date()), 'h:mm a')}</span> on <span className="text-gray-900 font-semibold">{format(date, 'MMM d')}</span>.</p>
                        <form onSubmit={handleRequestMeeting} className="max-w-lg mx-auto space-y-4">
                          {[
                              { id: 'duration', label: 'Meeting Duration', type: 'select', icon: <Clock size={16} /> },
                              { id: 'name', label: 'Your Name', type: 'text', placeholder: 'John Doe', state: name, setState: setName, icon: <User size={16} />, required: true },
                              { id: 'email', label: 'Your Email', type: 'email', placeholder: 'you@example.com', state: email, setState: setEmail, icon: <Mail size={16} />, required: true },
                              { id: 'phone', label: 'Phone Number (Optional)', type: 'tel', placeholder: 'e.g. +1 234 567 890', state: phone, setState: setPhone, icon: <Phone size={16} /> },
                              { id: 'location', label: 'Location / Link (Optional)', type: 'text', placeholder: 'e.g., Zoom, Office, Cafe', state: location, setState: setLocation, icon: <MapPin size={16} /> },
                              { id: 'subject', label: 'Purpose of Meeting (Optional)', type: 'textarea', placeholder: 'Briefly describe the topic...', state: subject, setState: setSubject, icon: <BookType size={16} /> },
                          ].map(f => (
                            <div key={f.id}>
                                <label htmlFor={f.id} className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                                <div className="relative">
                                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400 pointer-events-none">{f.icon}</span>
                                    {f.type === 'select' ? (
                                        <select id="duration" value={selectedDuration} onChange={e => setSelectedDuration(parseInt(e.target.value))} className="appearance-none pl-10 block w-full border border-gray-300 rounded-lg shadow-sm py-2.5 pr-10 focus:outline-none focus:ring-sky-500 focus:border-sky-500 bg-white">
                                            {availableDurations.map(d => (<option key={d} value={d}>{d} minutes</option>))}
                                        </select>
                                    ) : f.type === 'textarea' ? (
                                         <textarea id={f.id} placeholder={f.placeholder} value={f.state} onChange={e => f.setState?.(e.target.value)} rows={3} className="pl-10 block w-full border border-gray-300 rounded-lg shadow-sm py-2.5 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500" />
                                    ) : (
                                         <input id={f.id} type={f.type} placeholder={f.placeholder} value={f.state ?? ''} onChange={e => f.setState?.(e.target.value)} required={f.required} className="pl-10 block w-full border border-gray-300 rounded-lg shadow-sm py-2.5 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500" />
                                    )}
                                </div>
                            </div>
                          ))}
                          <button type="submit" disabled={isSubmitting} className="w-full flex items-center justify-center gap-2 bg-sky-600 text-white px-4 py-3 rounded-lg font-semibold hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:bg-sky-400 disabled:cursor-not-allowed transition-colors">
                            <Send size={18} />
                            {isSubmitting ? 'Sending Request...' : 'Confirm & Send Request'}
                          </button>
                        </form>
                      </div>
                    )}
                  </div>
                )
              })}
               {!isLoading && !upcomingDays.some(date => {
                    const dayKey = format(date, 'yyyy-MM-dd');
                    const dayAvailability = availability[dayKey] || [];
                    const blockedSlots = new Set<string>();
                     acceptedBookings.filter(b => b.date === dayKey).forEach(booking => {
                         let current = parse(booking.time, "HH:mm", new Date());
                         if(!isValid(current)) return;
                         const end = addMinutes(current, booking.duration);
                         while (isBefore(current, end)) {
                           blockedSlots.add(format(current, "HH:mm"));
                           current = addMinutes(current, 15);
                         }
                       });
                    const availableSlotCount = dayAvailability.flatMap(range => 
                        generateTimeSlots(range.start, range.end, range.interval).filter(time => !blockedSlots.has(time))
                    ).length;
                    return availableSlotCount > 0;
               }) && (
                 <div className="text-center bg-white rounded-2xl p-8 border border-gray-200 shadow-lg">
                    <h3 className="text-xl font-semibold text-gray-700">No Upcoming Availability</h3>
                    <p className="text-gray-500 mt-2">{profile?.name || profile?.username} has no open slots in the next {UPCOMING_DAYS_COUNT} days.</p>
                </div>
               )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}