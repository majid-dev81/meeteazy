// /app/u/[username]/page.tsx
'use client'

import React, { useEffect, useState, useMemo, FormEvent } from 'react'
import { useParams } from 'next/navigation'
import { db } from '@/lib/firebase'
import { collection, getDocs, query, where, addDoc, onSnapshot, doc, serverTimestamp } from 'firebase/firestore'
import { addDays, format, parse, isBefore, addMinutes, isValid } from 'date-fns'
import { clsx } from 'clsx'
import {
  User, Mail, Briefcase, Calendar, Clock, MapPin, Phone, BookType,
  Linkedin, Twitter, Globe, Info, Target, Send, CheckCircle2, Copy, Check,
  Users, X, PlusCircle, ChevronDown, ChevronUp,
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
  bufferTime?: number;
}

interface TimeRange {
  start: string
  end: string
  interval: number
}

interface TimeBlock {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
}

interface Availability {
  [dayKey: string]: {
    ranges: TimeRange[];
    blocks: TimeBlock[];
  };
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

// New interface for additional invitees
interface AdditionalInvitee {
  id: string;
  name: string;
  email: string;
}


// --- Constants ---
const DURATION_OPTIONS = [15, 30, 45, 60]
const UPCOMING_DAYS_COUNT = 30

const formatUrl = (url: string): string => {
  if (!url) return '#';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return `https://${url}`;
};

// --- Helper Components ---
const ProfileSection = ({ profile, username, isAvailableToday }: { profile: ProfileInfo | null; username: string; isAvailableToday: boolean }) => {
  const [copiedEmail, setCopiedEmail] = useState(false);

  const copyEmail = async () => {
    if (profile?.email) {
      await navigator.clipboard.writeText(profile.email);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    }
  };

  if (!profile) return null;

  const hasSocials = profile.linkedin || profile.twitter || profile.website || profile.whatsapp;
  const hasContactInfo = profile.showContact && profile.email;

  const Avatar = ({ name, imageUrl }: { name: string; imageUrl?: string }) => (
    <div className="relative w-32 h-32 md:w-40 md:h-40 mx-auto">
      <div className="w-full h-full rounded-full bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center border-4 border-white shadow-2xl overflow-hidden backdrop-blur-sm">
        {imageUrl ? (
          <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-5xl md:text-6xl font-bold bg-gradient-to-br from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            {name?.charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      {isAvailableToday && (
        <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-green-500 rounded-full border-4 border-white shadow-lg flex items-center justify-center">
          <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
        </div>
      )}
    </div>
  );

  const SectionBlock = ({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) => (
    <div className="border-t border-gray-100 pt-6 mt-6">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2 mb-4">
        {icon} {title}
      </h3>
      <div className="text-sm text-gray-700 leading-relaxed">{children}</div>
    </div>
  );

  const SocialButton = ({ href, icon, label, bgColorClass }: { href: string; icon: React.ReactNode; label: string; bgColorClass: string; }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={clsx(
        "group flex items-center justify-center gap-3 px-4 py-3.5 rounded-xl font-medium text-white transition-all duration-300 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]",
        bgColorClass
      )}
    >
      <span className="transition-transform group-hover:scale-110">{icon}</span>
      <span className="text-sm">{label}</span>
    </a>
  );

  return (
    <aside className="lg:sticky lg:top-8 space-y-6">
      {/* Main Profile Card */}
      <div className="bg-white/80 backdrop-blur-xl p-8 rounded-3xl border border-gray-200/50 shadow-xl relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 via-transparent to-indigo-50/30 pointer-events-none"></div>

        {/* Banner */}
        <div className="relative h-24 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-2xl overflow-hidden -m-8 mb-0">
          {profile.bannerUrl && (
            <img src={profile.bannerUrl} alt={`${profile.name}'s banner`} className="w-full h-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-purple-600/20"></div>
        </div>

        <div className="relative pt-6 -mt-16 text-center">
          <Avatar name={profile.name || profile.username} imageUrl={profile.photoUrl} />

          <div className="mt-6 space-y-2">
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
              {profile.name || profile.username}
            </h1>

            {(profile.role || profile.company) && (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-50/80 backdrop-blur-sm rounded-full border border-gray-200/50">
                <Briefcase size={14} className="text-gray-500" />
                <span className="text-sm font-medium text-gray-700">
                  {profile.role}{profile.role && profile.company && ' at '}{profile.company}
                </span>
              </div>
            )}
          </div>

          {isAvailableToday && (
            <div className="mt-6 pt-6 border-t border-gray-100">
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200/50 text-green-800 rounded-xl p-4 flex items-center justify-center gap-2 font-medium shadow-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <Clock size={16} />
                <span>Available for meetings today!</span>
              </div>
            </div>
          )}
        </div>

        {/* Social Links */}
        {hasSocials && (
          <div className="mt-8 pt-6 border-t border-gray-100 space-y-3">
            {profile.linkedin && (
              <SocialButton
                href={formatUrl(profile.linkedin)}
                label="LinkedIn"
                icon={<Linkedin size={18} />}
                bgColorClass="bg-gradient-to-r from-[#0077B5] to-[#00669c] hover:from-[#00669c] hover:to-[#005582]"
              />
            )}
            {profile.whatsapp && (
              <SocialButton
                href={`https://wa.me/${profile.whatsapp.replace(/\D/g, '')}`}
                label="WhatsApp"
                icon={<Phone size={18} />}
                bgColorClass="bg-gradient-to-r from-[#25D366] to-[#1ebe58] hover:from-[#1ebe58] hover:to-[#17a349]"
              />
            )}
            {profile.twitter && (
              <SocialButton
                href={formatUrl(profile.twitter)}
                label="X (Twitter)"
                icon={<Twitter size={18} />}
                bgColorClass="bg-gradient-to-r from-[#1DA1F2] to-[#1a91da] hover:from-[#1a91da] hover:to-[#1680c2]"
              />
            )}
            {profile.website && (
              <SocialButton
                href={formatUrl(profile.website)}
                label="Website"
                icon={<Globe size={18} />}
                bgColorClass="bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-800 hover:to-gray-900"
              />
            )}
          </div>
        )}

        {/* Profile Details */}
        <div className="text-left">
          {profile.focus && (
            <SectionBlock icon={<Target size={14} className="text-indigo-500" />} title="Looking For">
              <p className="whitespace-pre-wrap leading-relaxed">{profile.focus}</p>
            </SectionBlock>
          )}

          {profile.bio && (
            <SectionBlock icon={<Info size={14} className="text-blue-500" />} title="About">
              <p className="whitespace-pre-wrap leading-relaxed">{profile.bio}</p>
            </SectionBlock>
          )}

          {hasContactInfo && (
            <SectionBlock icon={<User size={14} className="text-purple-500" />} title="Contact">
              <div className="flex items-center gap-3 p-3 bg-gray-50/80 backdrop-blur-sm rounded-xl border border-gray-200/50">
                <Mail size={16} className="text-gray-500 shrink-0" />
                <span className="text-gray-700 flex-1 break-all text-sm">{profile.email}</span>
                <button
                  onClick={copyEmail}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-white rounded-lg transition-all duration-200 active:scale-95"
                  title="Copy email"
                >
                  {copiedEmail ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                </button>
              </div>
            </SectionBlock>
          )}
        </div>
      </div>

      {/* Map */}
      {profile.mapEmbedUrl && (
        <div className="bg-white/80 backdrop-blur-xl p-4 rounded-3xl border border-gray-200/50 shadow-xl overflow-hidden">
          <div className="aspect-w-16 aspect-h-9 rounded-2xl overflow-hidden">
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

  // State for additional invitees
  const [additionalInvitees, setAdditionalInvitees] = useState<AdditionalInvitee[]>([]);
  const [showInvitees, setShowInvitees] = useState(false);

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
        const userId = userDoc.id;

        setProfileId(userId);

        const userDocRef = doc(db, 'users', userId);
        unsubscribeUserDoc = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as ProfileInfo;
            const profileWithEmail = { ...data, email: userId };
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

  // --- Functions to manage invitees ---
  const addInvitee = () => {
    setAdditionalInvitees([...additionalInvitees, {
      id: `invitee-${Date.now()}`,
      name: '',
      email: ''
    }]);
  };

  const removeInvitee = (index: number) => {
    setAdditionalInvitees(additionalInvitees.filter((_, i) => i !== index));
  };

  const updateInvitee = (index: number, field: 'name' | 'email', value: string) => {
    const updated = [...additionalInvitees];
    updated[index] = { ...updated[index], [field]: value };
    setAdditionalInvitees(updated);
  };

  const toggleInviteesSection = () => {
    setShowInvitees(!showInvitees);
  };
  // ------------------------------------

  const generateTimeSlots = (startStr: string, endStr: string, interval: number): string[] => {
    const slots: string[] = [];
    let current = parse(startStr, 'HH:mm', new Date());
    const end = parse(endStr, 'HH:mm', new Date());
    if (!isValid(current) || !isValid(end)) return []
    while (isBefore(current, end)) {
      slots.push(format(current, 'HH:mm'));
      current = addMinutes(current, interval);
    }
    return slots
  }

  const isAvailableToday = useMemo(() => {
    if (isLoading || !availability[todayKey]) return false;

    const rawTodayData = availability[todayKey];
    const todayRanges = Array.isArray(rawTodayData) ? rawTodayData : (rawTodayData?.ranges || []);

    if (todayRanges.length === 0) return false;

    const blockedSlots = new Set<string>();
    acceptedBookings.filter(b => b.date === todayKey).forEach(booking => {
      let current = parse(booking.time, "HH:mm", new Date());
      if (!isValid(current)) return;
      const end = addMinutes(current, booking.duration + (profile?.bufferTime || 0));
      while (isBefore(current, end)) {
        blockedSlots.add(format(current, "HH:mm"));
        current = addMinutes(current, 15);
      }
    });

    const availableTodaySlots = todayRanges.flatMap(range =>
      generateTimeSlots(range.start, range.end, range.interval).filter(time => !blockedSlots.has(time))
    );
    return availableTodaySlots.length > 0;
  }, [isLoading, availability, acceptedBookings, todayKey, profile?.bufferTime]);

  const handleSelectTime = (dateKey: string, time: string, maxDuration: number) => {
    setSelectedSlot({ date: dateKey, time, maxDuration })
    setShowSuccess(false)
    const allowed = DURATION_OPTIONS.filter(d => d <= maxDuration)
    setAvailableDurations(allowed)
    if (!allowed.includes(selectedDuration)) setSelectedDuration(allowed[0] || DURATION_OPTIONS[1])
  }

  const handleRequestMeeting = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile || !profileId || !selectedSlot || !name || !email || !location || !subject) {
      setError('Please fill out all required fields and select a time slot.');
      return;
    }

    // Validate additional invitees
    for (const invitee of additionalInvitees) {
      if (!invitee.name || !invitee.email) {
        setError('Please provide a name and email for all invitees, or remove the empty fields.');
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);

    try {
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
        additionalInvitees: additionalInvitees, // Add invitees to booking data
      };

      const bookingsCollectionRef = collection(db, 'users', profileId, 'bookings');
      await addDoc(bookingsCollectionRef, newBookingData);

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
        additionalInvitees: additionalInvitees, // Add invitees to email payload
      };

      const emailResponse = await fetch('/api/send-booking-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailPayload),
      });

      if (!emailResponse.ok) {
        const emailResult = await emailResponse.json();
        console.error('API Error: Failed to send booking request email:', emailResult.details);
      } else {
        console.log('Booking request email sent successfully.');
      }

      setShowSuccess(true);
      setSelectedSlot(null);
      setName('');
      setEmail('');
      setPhone('');
      setSubject('');
      setLocation('');
      setAdditionalInvitees([]); // Reset invitees on success
      setShowInvitees(false);

    } catch (err) {
      console.error('Failed to submit booking request:', err);
      setError('Could not submit your booking request. Please try again later.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-gray-600 font-medium">Loading availability...</p>
        </div>
      </div>
    )
  }

  if (error && !isSubmitting) { // Only show full page error if not related to form submission
    return (
      <div className="flex justify-center items-center h-screen bg-gradient-to-br from-red-50 via-white to-pink-50">
        <div className="text-center p-8 bg-white rounded-2xl border border-red-200 shadow-xl max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-red-500 text-2xl">⚠️</span>
          </div>
          <p className="text-red-600 font-medium">{error}</p>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="flex justify-center items-center h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50">
        <div className="text-center p-8 bg-white rounded-2xl border border-gray-200 shadow-xl max-w-md">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="text-gray-500" size={32} />
          </div>
          <p className="text-gray-600 font-medium">Profile not found.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 lg:gap-12">

          {/* Profile Section */}
          <div className="lg:col-span-4">
            <ProfileSection profile={profile} username={username} isAvailableToday={isAvailableToday} />
          </div>

          {/* Booking Section */}
          <div className="lg:col-span-8 mt-8 lg:mt-0">
            {/* Success Message */}
            {showSuccess && !selectedSlot && (
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-6 mb-8 shadow-lg">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 size={24} className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-green-900 mb-1">Request Sent Successfully!</h3>
                    <p className="text-green-800">
                      You'll receive an email confirmation once {profile?.name || profile?.username} accepts your meeting request.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Header */}
            <div className="mb-8 text-center lg:text-left">
              <h2 className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-gray-800 via-gray-700 to-gray-600 bg-clip-text text-transparent mb-4">
                Book a Meeting
              </h2>
              <p className="text-gray-600 text-lg lg:text-xl leading-relaxed max-w-2xl">
                Choose an available time slot below to schedule your meeting with {profile?.name || profile?.username}.
              </p>
            </div>

            {/* Time Slots */}
            <div className="space-y-6">
              {upcomingDays.map(date => {
                const dayKey = format(date, 'yyyy-MM-dd');

                const rawDayData = availability[dayKey];
                const dayRanges = Array.isArray(rawDayData) ? rawDayData : (rawDayData?.ranges || []);
                const dayBlocks = Array.isArray(rawDayData?.blocks) ? rawDayData.blocks : [];

                const bufferTime = profile.bufferTime || 0;

                const blockedSlots = new Set<string>();

                acceptedBookings.filter(b => b.date === dayKey).forEach(booking => {
                  let current = parse(booking.time, "HH:mm", new Date(dayKey));
                  if (!isValid(current)) return;
                  const totalBlockDuration = booking.duration + bufferTime;
                  const end = addMinutes(current, totalBlockDuration);
                  while (isBefore(current, end)) {
                    blockedSlots.add(format(current, "HH:mm"));
                    current = addMinutes(current, 15);
                  }
                });

                dayBlocks.forEach(block => {
                  let current = parse(block.startTime, "HH:mm", new Date(dayKey));
                  if (!isValid(current)) return;
                  const end = parse(block.endTime, "HH:mm", new Date(dayKey));
                  while (isBefore(current, end)) {
                    blockedSlots.add(format(current, "HH:mm"));
                    current = addMinutes(current, 15);
                  }
                });

                const uniqueSlots = new Map<string, number>();
                dayRanges.forEach(range => {
                  const slots = generateTimeSlots(range.start, range.end, range.interval);
                  slots.forEach(time => {
                    if (!blockedSlots.has(time)) {
                      const slotDateTime = parse(time, "HH:mm", new Date(dayKey));
                      const slotEndDateTime = addMinutes(slotDateTime, range.interval + bufferTime);
                      const rangeEndDateTime = parse(range.end, "HH:mm", new Date(dayKey));

                      if (isBefore(slotEndDateTime, addMinutes(rangeEndDateTime, 1))) {
                        const existingDuration = uniqueSlots.get(time) || 0;
                        uniqueSlots.set(time, Math.max(existingDuration, range.interval));
                      }
                    }
                  });
                });

                const availableSlots = Array.from(uniqueSlots.entries())
                  .map(([time, maxDuration]) => ({ time, maxDuration }))
                  .sort((a, b) => a.time.localeCompare(b.time));

                if (availableSlots.length === 0) return null

                return (
                  <div key={dayKey} className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-3xl p-6 lg:p-8 shadow-xl">
                    <h3 className="font-bold text-xl lg:text-2xl text-gray-800 mb-6 flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center">
                        <Calendar size={20} className="text-white" />
                      </div>
                      <span className="bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                        {format(date, 'EEEE, MMMM d')}
                      </span>
                    </h3>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                      {availableSlots.map(({ time, maxDuration }) => (
                        <button
                          key={time}
                          onClick={() => handleSelectTime(dayKey, time, maxDuration)}
                          className={clsx(
                            'px-4 py-3.5 rounded-xl border font-medium text-sm transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 active:scale-95',
                            selectedSlot?.date === dayKey && selectedSlot?.time === time
                              ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white border-transparent shadow-lg scale-105'
                              : 'bg-white/70 hover:bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:shadow-md hover:scale-[1.02]'
                          )}
                        >
                          {format(parse(time, 'HH:mm', new Date()), 'h:mm a')}
                        </button>
                      ))}
                    </div>

                    {/* Booking Form */}
                    {selectedSlot?.date === dayKey && (
                      <div className="mt-8 border-t border-gray-200/50 pt-8">
                        <div className="text-center mb-8">
                          <h3 className="text-2xl font-bold text-gray-800 mb-2">Meeting Details</h3>
                          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-full">
                            <Clock size={16} className="text-blue-600" />
                            <span className="text-blue-800 font-medium">
                              {format(parse(selectedSlot.time, 'HH:mm', new Date()), 'h:mm a')} on {format(date, 'MMM d, yyyy')}
                            </span>
                          </div>
                        </div>

                        <form onSubmit={handleRequestMeeting} className="max-w-2xl mx-auto space-y-6">
                          {/* Form Submission Error */}
                          {error && isSubmitting && (
                            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-800 text-sm">
                              {error}
                            </div>
                          )}

                          {[
                            {
                              id: 'duration',
                              label: 'Meeting Duration',
                              type: 'select',
                              icon: <Clock size={18} className="text-blue-500" />
                            },
                            {
                              id: 'name',
                              label: 'Your Name',
                              type: 'text',
                              placeholder: 'John Doe',
                              state: name,
                              setState: setName,
                              icon: <User size={18} className="text-purple-500" />,
                              required: true
                            },
                            {
                              id: 'email',
                              label: 'Your Email',
                              type: 'email',
                              placeholder: 'you@example.com',
                              state: email,
                              setState: setEmail,
                              icon: <Mail size={18} className="text-green-500" />,
                              required: true
                            },
                            {
                              id: 'phone',
                              label: 'Phone Number (Optional)',
                              type: 'tel',
                              placeholder: 'e.g. +1 234 567 890',
                              state: phone,
                              setState: setPhone,
                              icon: <Phone size={18} className="text-orange-500" />
                            },
                            {
                              id: 'location',
                              label: 'Meeting Location',
                              type: 'text',
                              placeholder: 'e.g., Zoom, Office, Cafe',
                              state: location,
                              setState: setLocation,
                              icon: <MapPin size={18} className="text-red-500" />,
                              required: true
                            },
                            {
                              id: 'subject',
                              label: 'Meeting Purpose',
                              type: 'textarea',
                              placeholder: 'Briefly describe what you\'d like to discuss...',
                              state: subject,
                              setState: setSubject,
                              icon: <BookType size={18} className="text-indigo-500" />,
                              required: true
                            },
                          ].map(field => (
                            <div key={field.id} className="space-y-2">
                              <label htmlFor={field.id} className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
                                {field.icon}
                                {field.label}
                                {field.required && <span className="text-red-500">*</span>}
                              </label>
                              <div className="relative group">
                                {field.type === 'select' ? (
                                  <select
                                    id="duration"
                                    value={selectedDuration}
                                    onChange={e => setSelectedDuration(parseInt(e.target.value))}
                                    className="w-full pl-12 pr-4 py-4 border border-gray-300 rounded-xl shadow-sm bg-white/80 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 group-hover:shadow-md"
                                  >
                                    {availableDurations.map(d => (
                                      <option key={d} value={d}>{d} minutes</option>
                                    ))}
                                  </select>
                                ) : field.type === 'textarea' ? (
                                  <textarea
                                    id={field.id}
                                    placeholder={field.placeholder}
                                    value={field.state}
                                    onChange={e => field.setState?.(e.target.value)}
                                    rows={4}
                                    required={field.required}
                                    className="w-full pl-12 pr-4 py-4 border border-gray-300 rounded-xl shadow-sm bg-white/80 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 resize-none group-hover:shadow-md"
                                  />
                                ) : (
                                  <input
                                    id={field.id}
                                    type={field.type}
                                    placeholder={field.placeholder}
                                    value={field.state ?? ''}
                                    onChange={e => field.setState?.(e.target.value)}
                                    required={field.required}
                                    className="w-full pl-12 pr-4 py-4 border border-gray-300 rounded-xl shadow-sm bg-white/80 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 group-hover:shadow-md"
                                  />
                                )}
                                <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                                  {field.icon}
                                </div>
                              </div>
                            </div>
                          ))}

                          {/* --- NEW: Additional Invitees Section --- */}
                          <div className="space-y-4 pt-4 border-t border-gray-200/50">
                            <div className="flex items-center justify-between">
                              <label className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
                                <Users size={18} className="text-blue-500" />
                                Additional Invitees
                              </label>
                              <button
                                type="button"
                                onClick={toggleInviteesSection}
                                className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100/80 rounded-full transition-all"
                                aria-label="Toggle invitees section"
                                aria-expanded={showInvitees}
                              >
                                {showInvitees ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                              </button>
                            </div>

                            {showInvitees && (
                              <div className="space-y-4">
                                {additionalInvitees.map((invitee, index) => (
                                  <div key={invitee.id} className="relative grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50/80 backdrop-blur-sm border border-gray-200/50 rounded-xl">
                                    <div className="relative">
                                      <input
                                        placeholder="Invitee Name"
                                        value={invitee.name}
                                        onChange={(e) => updateInvitee(index, 'name', e.target.value)}
                                        required
                                        className="w-full pl-4 pr-4 py-3 border border-gray-300 rounded-lg shadow-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                      />
                                    </div>
                                    <div className="relative">
                                      <input
                                        type="email"
                                        placeholder="Invitee Email"
                                        value={invitee.email}
                                        onChange={(e) => updateInvitee(index, 'email', e.target.value)}
                                        required
                                        className="w-full pl-4 pr-4 py-3 border border-gray-300 rounded-lg shadow-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                      />
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => removeInvitee(index)}
                                      className="absolute -top-2.5 -right-2.5 p-1 bg-white text-gray-500 border border-gray-300 rounded-full hover:bg-red-500 hover:text-white hover:scale-110 hover:border-red-500 transition-all"
                                      title="Remove Invitee"
                                    >
                                      <X size={16} />
                                    </button>
                                  </div>
                                ))}

                                <button
                                  type="button"
                                  onClick={addInvitee}
                                  className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-600 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50/50 font-medium transition-all duration-300"
                                >
                                  <PlusCircle size={18} />
                                  Add Invitee
                                </button>
                              </div>
                            )}
                          </div>
                          {/* --- END: Additional Invitees Section --- */}


                          <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-4 rounded-xl font-semibold text-lg hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-xl active:scale-[0.98]"
                          >
                            <Send size={20} />
                            {isSubmitting ? (
                              <>
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                Sending Request...
                              </>
                            ) : (
                              'Send Meeting Request'
                            )}
                          </button>
                        </form>
                      </div>
                    )}
                  </div>
                )
              })}

              {/* No Availability Message */}
              {!isLoading && !upcomingDays.some(date => {
                const dayKey = format(date, 'yyyy-MM-dd');
                const rawDayData = availability[dayKey];
                const dayRanges = Array.isArray(rawDayData) ? rawDayData : (rawDayData?.ranges || []);
                return dayRanges.length > 0;
              }) && (
                  <div className="text-center bg-white/80 backdrop-blur-xl rounded-3xl p-12 border border-gray-200/50 shadow-xl">
                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Calendar size={40} className="text-gray-400" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-700 mb-3">No Available Slots</h3>
                    <p className="text-gray-500 text-lg max-w-md mx-auto leading-relaxed">
                      {profile?.name || profile?.username} doesn't have any open time slots in the next {UPCOMING_DAYS_COUNT} days. Please check back later.
                    </p>
                  </div>
                )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}