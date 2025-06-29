// app/dashboard/page.tsx
'use client'

import { useEffect, useState, useMemo, useCallback, ReactNode, Fragment } from 'react'
import { auth, db } from '@/lib/firebase'
import { onAuthStateChanged, signOut, User } from 'firebase/auth'
import { doc, setDoc, getDoc, collection, query, onSnapshot, updateDoc, Timestamp } from 'firebase/firestore'
import { useRouter } from 'next/navigation'
import { addDays, format, isBefore, parse, isValid, isToday, isPast, getHours, subDays } from 'date-fns'
import { clsx } from 'clsx'
import { Disclosure, Transition } from '@headlessui/react'
import {
  AlertTriangle, BookUser, BrainCircuit, Calendar as CalendarIconLucide, Check, ChevronDown,
  Clipboard, ClipboardCheck, Clock, Info, Link as LinkIcon, LogOut, User as UserIcon, X,
  Coffee, MessageSquare, Send, CalendarClock, Sparkles, Copy, Building,
} from 'lucide-react'

// --- Type Definitions ---
interface ProfileData { name: string; role: string; company: string; showContact: boolean; }
interface TimeRange { start: string; end: string; interval: number; }
interface Availability { [dayKey: string]: TimeRange[]; }
type BookingStatus = 'pending' | 'accepted' | 'declined' | 'canceled' | 'arranged'
interface Booking { id: string; name: string; email: string; phone?: string; subject: string; location?: string; date: string; time: string; duration: number; status: BookingStatus; createdAt: Timestamp; cancellationNote?: string; }

// --- Constants ---
const DEFAULT_RANGE = { start: '', end: '', interval: 30 };
const INTERVALS = [15, 30, 45, 60];
const VISIBLE_BOOKINGS_LIMIT = 3;
const BACK_TO_BACK_THRESHOLD = 3; // Min meetings for buffer suggestion


// --- Redesigned Helper Components ---

const StatCard = ({ title, value, note, icon }: { title: string; value: string | number; note?: string; icon: ReactNode }) => (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-start gap-4 transition-all hover:border-slate-300 hover:shadow-md">
        <div className="bg-slate-100 p-3 rounded-lg text-blue-600">{icon}</div>
        <div>
            <p className="text-sm font-medium text-slate-500">{title}</p>
            <p className="text-2xl font-bold text-slate-800 truncate">{value}</p>
            {note && <p className="text-xs text-slate-400 mt-1">{note}</p>}
        </div>
    </div>
);


// --- Smart Assistant Component ---
const SmartAssistant = ({
    profileData,
    availability,
    bookings,
    onScrollTo,
    onReviewPending,
    onCancelBooking,
}: {
    profileData: ProfileData;
    availability: Availability;
    bookings: Booking[];
    onScrollTo: (id: string) => void;
    onReviewPending: () => void;
    onCancelBooking: (booking: Booking) => void;
}) => {
    const [isVisible, setIsVisible] = useState(false);
    useEffect(() => {
        const timer = setTimeout(() => setIsVisible(true), 100);
        return () => clearTimeout(timer);
    }, []);

    const assistantState = useMemo(() => {
        const name = profileData.name?.split(' ')[0] || 'there';
        const currentHour = getHours(new Date());
        let greeting = `Hi ${name} 👋`;
        if (currentHour >= 5 && currentHour < 12) greeting = `Good morning, ${name}!`;
        if (currentHour >= 12 && currentHour < 18) greeting = `Good afternoon, ${name}.`;
        if (currentHour >= 18) greeting = `Good evening, ${name}.`;

        const suggestions = [];

        // 1. Profile empty?
        if (!profileData.name || !profileData.role) {
            suggestions.push({
                type: 'prompt',
                icon: <UserIcon size={18} />,
                title: "Let's set up your profile.",
                text: "Add your name and role to look more professional to your clients.",
                actionText: "Go to Profile",
                action: () => onScrollTo('profile-section'),
                priority: 10,
            });
        }

        // 2. Availability not set?
        if (Object.keys(availability).length === 0) {
            suggestions.push({
                type: 'prompt',
                icon: <BrainCircuit size={18} />,
                title: "When are you free?",
                text: "Define your availability so people can start booking meetings with you.",
                actionText: "Set Availability",
                action: () => onScrollTo('availability-section'),
                priority: 9,
            });
        }
        
        // 3. Pending bookings?
        const pendingBookings = bookings.filter(b => b.status === 'pending');
        if (pendingBookings.length > 0) {
             suggestions.push({
                type: 'prompt',
                icon: <Clock size={18} />,
                title: `You have ${pendingBookings.length} pending request${pendingBookings.length > 1 ? 's' : ''}!`,
                text: "It's best to review them soon to keep your clients updated.",
                actionText: "Review Requests",
                action: onReviewPending,
                priority: 8,
            });
        }
        
        // ✨ NEW AI FEATURE: Check for back-to-back meetings
        const acceptedBookingsByDate = bookings
            .filter(b => b.status === 'accepted' && !isPast(new Date(b.date)))
            .reduce((acc, b) => {
                acc[b.date] = (acc[b.date] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

        const busyDay = Object.entries(acceptedBookingsByDate).find(([_, count]) => count >= BACK_TO_BACK_THRESHOLD);
        if (busyDay) {
            suggestions.push({
                type: 'insight',
                icon: <Sparkles size={18} />,
                title: "A heads-up on your schedule",
                text: `You have ${busyDay[1]} meetings on ${format(new Date(busyDay[0]), 'MMM d')}. Consider increasing your meeting intervals to add breathing room.`,
                actionText: "Review Availability",
                action: () => onScrollTo('availability-section'),
                priority: 5,
            });
        }

        const todaysAcceptedBookings = bookings
            .filter(b => b.status === 'accepted' && isToday(new Date(b.date)))
            .sort((a, b) => a.time.localeCompare(b.time));

        // If no primary suggestions, add a default friendly message
        if (suggestions.length === 0 && todaysAcceptedBookings.length === 0) {
            suggestions.push({
                type: 'info',
                icon: <Coffee size={18}/>,
                title: "All clear for today!",
                text: "You have no meetings scheduled. A great day to plan ahead or take a break.",
                priority: 1,
            });
        }

        const primarySuggestion = suggestions.sort((a, b) => b.priority - a.priority)[0];
        
        return { greeting, todaysAcceptedBookings, primarySuggestion };
    }, [profileData, availability, bookings, onScrollTo, onReviewPending]);

    const renderTimelineItemAction = (booking: Booking) => (
        <div className="flex items-center gap-1">
            <button
                onClick={() => onCancelBooking(booking)}
                className="p-2 rounded-md text-slate-500 hover:bg-red-100 hover:text-red-700 transition-colors"
                title="Cancel Meeting"
            >
                <X size={16} />
            </button>
            <button
                onClick={() => onScrollTo('availability-section')}
                className="p-2 rounded-md text-slate-500 hover:bg-blue-100 hover:text-blue-700 transition-colors"
                title="Reschedule"
            >
                <CalendarClock size={16} />
            </button>
            <a
                href={`mailto:${booking.email}?subject=Reminder: Meeting at ${format(parse(booking.time, 'HH:mm', new Date()), 'h:mm a')}&body=Hi ${booking.name},%0D%0A%0D%0AJust a friendly reminder about our upcoming meeting today at ${format(parse(booking.time, 'HH:mm', new Date()), 'h:mm a')}.%0D%0A%0D%0ASubject: ${booking.subject}%0D%0A%0D%0ALooking forward to it!%0D%0A%0D%0ABest,%0D%0A${profileData.name}`}
                className="p-2 rounded-md text-slate-500 hover:bg-green-100 hover:text-green-700 transition-colors"
                title="Send Reminder"
            >
                <Send size={16} />
            </a>
        </div>
    );

    return (
        <div className={clsx(
            "bg-gradient-to-br from-blue-50 via-white to-indigo-50 border border-slate-200 p-6 rounded-2xl shadow-sm transition-all duration-500 ease-in-out",
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"
        )}>
            <div className="flex items-start gap-4">
                 <div className="bg-white p-3 rounded-full border border-slate-200 shadow-sm relative">
                    <BrainCircuit size={32} className="text-blue-600" />
                     <span className="absolute top-0 right-0 block h-3 w-3 rounded-full bg-green-400 ring-2 ring-white animate-pulse" />
                </div>

                <div className="flex-1">
                    <h3 className="font-bold text-slate-900 text-xl leading-tight">{assistantState.greeting}</h3>
                    
                    {assistantState.todaysAcceptedBookings.length > 0 ? (
                        <>
                            <p className="text-sm text-slate-600 mt-1.5">
                                You have <span className="font-bold">{assistantState.todaysAcceptedBookings.length}</span> meeting{assistantState.todaysAcceptedBookings.length > 1 ? 's' : ''} on your schedule for today.
                            </p>
                            <div className="mt-4 -ml-4 flow-root">
                                <ul className="mb-0">
                                    {assistantState.todaysAcceptedBookings.map((booking, index) => (
                                        <li key={booking.id}>
                                            <div className="relative pb-6">
                                                {index !== assistantState.todaysAcceptedBookings.length - 1 ? (
                                                    <span className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-slate-200" aria-hidden="true" />
                                                ) : null}
                                                <div className="relative flex items-start space-x-3">
                                                    <div>
                                                        <div className={clsx(
                                                          "h-8 w-8 rounded-full flex items-center justify-center ring-4",
                                                          isPast(parse(booking.time, 'HH:mm', new Date(booking.date))) ? "bg-slate-300 ring-slate-100" : "bg-blue-500 ring-white"
                                                        )}>
                                                          <Clock size={16} className={isPast(parse(booking.time, 'HH:mm', new Date(booking.date))) ? "text-slate-600" : "text-white"} />
                                                        </div>
                                                    </div>
                                                    <div className="min-w-0 flex-1 bg-white/70 backdrop-blur-sm border border-slate-200/80 rounded-lg p-3 pt-2.5">
                                                        <div className="flex justify-between items-center">
                                                          <div>
                                                              <p className="text-xs font-semibold text-blue-700">
                                                                {format(parse(booking.time, 'HH:mm', new Date()), 'h:mm a')}
                                                              </p>
                                                              <p className="font-semibold text-slate-800 text-sm mt-0.5">{booking.subject}</p>
                                                              <p className="text-xs text-slate-500">with {booking.name}</p>
                                                          </div>
                                                          {renderTimelineItemAction(booking)}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </>
                    ) : (
                       assistantState.primarySuggestion && (
                         <div className="mt-2 bg-white/60 p-4 rounded-lg border border-slate-200/80 flex items-start gap-4">
                            <div className="text-blue-600 bg-blue-100 p-2 rounded-full mt-1">
                                {assistantState.primarySuggestion.icon}
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800">{assistantState.primarySuggestion.title}</h4>
                                <p className="text-sm text-slate-600 mt-0.5">{assistantState.primarySuggestion.text}</p>
                                {(assistantState.primarySuggestion.type === 'prompt' || assistantState.primarySuggestion.type === 'insight') && (
                                    <button onClick={assistantState.primarySuggestion.action} className="mt-3 bg-blue-600 text-white px-3 py-1.5 text-xs font-semibold rounded-md hover:bg-blue-700 transition-all shadow-sm">
                                        {assistantState.primarySuggestion.actionText}
                                    </button>
                                )}
                            </div>
                         </div>
                       )
                    )}
                    
                     <div className="mt-4 pt-4 border-t border-slate-200/80 flex flex-wrap gap-2">
                         {assistantState.todaysAcceptedBookings.length === 0 && assistantState.primarySuggestion?.type === 'info' && (
                            <button onClick={() => onScrollTo('availability-section')} className="flex items-center gap-1.5 bg-white border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 rounded-lg hover:bg-slate-100 transition-colors">
                                <BrainCircuit size={14} /> Plan Ahead
                            </button>
                         )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const CollapsibleSection = ({ id, title, icon, summary, children, defaultOpen = false }: { id?: string; title: string, icon: ReactNode, summary?: string, children: ReactNode, defaultOpen?: boolean }) => (
    <Disclosure as="div" id={id} className="bg-white border border-slate-200 rounded-2xl shadow-sm" defaultOpen={defaultOpen}>
        {({ open }) => (
            <>
                <Disclosure.Button className="w-full flex justify-between items-center p-4 sm:p-5 text-left transition-colors hover:bg-slate-50/50 rounded-t-2xl">
                    <div className="flex items-center gap-4">
                        <div className="text-slate-500">{icon}</div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-800">{title}</h2>
                            {summary && <p className="text-sm text-slate-500">{summary}</p>}
                        </div>
                    </div>
                    <ChevronDown className={clsx("w-6 h-6 text-slate-500 transition-transform duration-300", open && "rotate-180")} />
                </Disclosure.Button>
                <Transition as={Fragment} enter="transition-all ease-in-out duration-300" enterFrom="opacity-0 max-h-0" enterTo="opacity-100 max-h-[2000px]" leave="transition-all ease-in-out duration-200" leaveFrom="opacity-100 max-h-[2000px]" leaveTo="opacity-0 max-h-0">
                    <Disclosure.Panel className="overflow-hidden">
                        <div className="p-4 sm:p-6 border-t border-slate-200">{children}</div>
                    </Disclosure.Panel>
                </Transition>
            </>
        )}
    </Disclosure>
);

const StatusBadge = ({ status }: { status: BookingStatus }) => {
    const config = {
        pending: { icon: <Clock size={12} />, styles: 'bg-yellow-100 text-yellow-800 ring-1 ring-inset ring-yellow-200' },
        accepted: { icon: <Check size={12} />, styles: 'bg-green-100 text-green-800 ring-1 ring-inset ring-green-200' },
        declined: { icon: <X size={12} />, styles: 'bg-red-100 text-red-800 ring-1 ring-inset ring-red-200' },
        canceled: { icon: <AlertTriangle size={12} />, styles: 'bg-slate-100 text-slate-800 ring-1 ring-inset ring-slate-200' },
        arranged: { icon: <Check size={12} />, styles: 'bg-blue-100 text-blue-800 ring-1 ring-inset ring-blue-200' },
    }[status] || { icon: <Clock size={12} />, styles: 'bg-gray-100 text-gray-800' };
    return <span className={clsx('px-2.5 py-1 text-xs font-semibold rounded-full capitalize inline-flex items-center gap-1.5', config.styles)}>{config.icon}{status}</span>
}

const BookingCard = ({ booking, onUpdateStatus, onCancel }: { booking: Booking; onUpdateStatus: (id: string, status: BookingStatus) => void; onCancel: (booking: Booking) => void }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  return (
    <div className="border border-slate-200 rounded-xl bg-slate-50/50">
      <div className="p-4 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex justify-between items-start gap-4">
          <div>
            <p className="font-semibold text-slate-800">{booking.name}</p>
            <p className="text-sm text-slate-500">{format(new Date(booking.date), 'EEEE, MMM d')} at {booking.time}</p>
            <p className="text-sm text-slate-600 mt-1 font-medium">"{booking.subject || 'No Subject'}"</p>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <StatusBadge status={booking.status} />
            <ChevronDown className={clsx('w-5 h-5 text-slate-400 transition-transform', isExpanded && 'rotate-180')} />
          </div>
        </div>
      </div>
      {isExpanded && <div className="border-t border-slate-200 p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <p><strong className="font-semibold text-slate-600 block">Email:</strong> <a href={`mailto:${booking.email}`} className="text-blue-600 hover:underline">{booking.email}</a></p>
          {booking.phone && <p><strong className="font-semibold text-slate-600 block">Phone:</strong> {booking.phone}</p>}
          <p><strong className="font-semibold text-slate-600 block">Location:</strong> {booking.location || 'N/A'}</p>
          <p><strong className="font-semibold text-slate-600 block">Duration:</strong> {booking.duration} minutes</p>
        </div>
        <p className="text-xs text-slate-400 pt-2 border-t border-slate-100">Requested on {format(booking.createdAt.toDate(), 'PPpp')}</p>
        {booking.status === 'pending' && <div className="flex gap-2 pt-2"><button onClick={() => onUpdateStatus(booking.id, 'accepted')} className="flex-1 sm:flex-none bg-green-600 text-white px-3 py-1.5 rounded-md text-sm font-semibold hover:bg-green-700">Accept</button><button onClick={() => onUpdateStatus(booking.id, 'declined')} className="flex-1 sm:flex-none bg-red-600 text-white px-3 py-1.5 rounded-md text-sm font-semibold hover:bg-red-700">Decline</button></div>}
        {booking.status === 'accepted' && <div className="flex gap-2 pt-2"><button onClick={(e) => { e.stopPropagation(); onCancel(booking); }} className="flex-1 sm:flex-none bg-slate-700 text-white px-3 py-1.5 rounded-md text-sm font-semibold hover:bg-slate-800">Cancel Booking</button></div>}
        {booking.status === 'canceled' && booking.cancellationNote && <div className="mt-3 p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded-r-md"><p className="text-sm font-semibold text-yellow-800">Your note:</p><p className="text-sm text-yellow-700">{booking.cancellationNote}</p></div>}
      </div>}
    </div>
  )
}

const CancellationModal = ({ isOpen, onClose, onConfirm, booking, note, setNote, isCancelling }: { isOpen: boolean; onClose: () => void; onConfirm: () => void; booking: Booking | null; note: string; setNote: (note: string) => void; isCancelling: boolean }) => {
  if (!isOpen || !booking) return null;
  return <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center p-4" aria-modal="true" role="dialog"><div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}><div className="p-6"><h3 className="text-lg font-bold text-slate-900">Cancel Booking</h3><p className="mt-2 text-sm text-slate-500">Are you sure you want to cancel with <span className="font-semibold">{booking.name}</span>?</p><div className="mt-4"><label htmlFor="cancellationNote" className="block text-sm font-medium text-slate-700">Note (Optional)</label><textarea id="cancellationNote" rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Let them know why..." className="mt-1 block w-full border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" /></div></div><div className="bg-slate-50 px-6 py-4 flex flex-col-reverse sm:flex-row-reverse gap-3 rounded-b-xl"><button type="button" onClick={onConfirm} disabled={isCancelling} className="w-full sm:w-auto justify-center rounded-md border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 disabled:bg-red-300">{isCancelling ? 'Cancelling...' : 'Yes, Cancel'}</button><button type="button" onClick={onClose} disabled={isCancelling} className="w-full sm:w-auto justify-center rounded-md border-slate-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-slate-700 hover:bg-slate-50">Keep Booking</button></div></div></div>
}

// --- Main Dashboard Page Component ---
export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState<string>('');
  const [availability, setAvailability] = useState<Availability>({});
  const [profileData, setProfileData] = useState<ProfileData>({ name: '', role: '', company: '', showContact: false });
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<BookingStatus | 'all'>('pending');
  const [showAllBookings, setShowAllBookings] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState<Booking | null>(null);
  const [cancellationNote, setCancellationNote] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [showProfileSaveSuccess, setShowProfileSaveSuccess] = useState(false);
  // ✨ NEW AI FEATURE: State for profile nudge
  const [showCompanyNudge, setShowCompanyNudge] = useState(false);
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  // Memoize the public link for sharing
  const publicLink = useMemo(() => {
    if (typeof window !== 'undefined') {
        return `${window.location.origin}/u/${username}`;
    }
    return '';
  }, [username]);

  useEffect(() => {
    const authUnsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser?.email) {
        setUser(currentUser);
        const userRef = doc(db, 'users', currentUser.email);
        const userUnsubscribe = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setUsername(data.username || '');
            setAvailability(data.availability || {});
            const newProfileData = { name: data.name || '', role: data.role || '', company: data.company || '', showContact: !!data.showContact };
            setProfileData(newProfileData);
            
            // ✨ NEW AI FEATURE: Logic for company nudge
            const acceptedCount = bookings.filter(b => b.status === 'accepted').length;
            if (!newProfileData.company && acceptedCount > 2) {
                setShowCompanyNudge(true);
            } else {
                setShowCompanyNudge(false);
            }
          }
        });

        const bookingsRef = collection(db, 'users', currentUser.email, 'bookings');
        const bookingsUnsubscribe = onSnapshot(query(bookingsRef), (snapshot) => {
          const fetchedBookings = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Booking)).sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
          setBookings(fetchedBookings);
          setIsLoading(false);
          
          // ✨ NEW AI FEATURE: Check company nudge condition after bookings load
          if (profileData && !profileData.company && fetchedBookings.filter(b => b.status === 'accepted').length > 2) {
              setShowCompanyNudge(true);
          }

        });

        return () => { userUnsubscribe(); bookingsUnsubscribe(); };
      } else {
        router.push('/signin');
      }
    });
    return () => authUnsubscribe();
  }, [router, bookings.length]); // Re-run effect if booking count changes for nudge logic
  
  const dashboardStats = useMemo(() => {
    const todaysAcceptedBookings = bookings.filter(b => b.status === 'accepted' && isToday(new Date(b.date))).sort((a, b) => a.time.localeCompare(b.time));
    const nextMeeting = todaysAcceptedBookings[0];
    const pendingRequestsCount = bookings.filter(b => b.status === 'pending').length;
    return { todaysAcceptedBookings, nextMeeting, pendingRequestsCount };
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    const bookingsToShow = activeTab === 'all' ? bookings : bookings.filter(b => b.status === activeTab);
    return showAllBookings ? bookingsToShow : bookingsToShow.slice(0, VISIBLE_BOOKINGS_LIMIT);
  }, [bookings, activeTab, showAllBookings]);

  const totalFilteredBookingsCount = useMemo(() => {
     if (activeTab === 'all') return bookings.length;
     return bookings.filter(b => b.status === activeTab).length;
  }, [bookings, activeTab]);

  const saveProfile = async () => {
    if (!user?.email) return;
    setIsSavingProfile(true);
    setShowCompanyNudge(false); // Hide nudge on save
    try {
      await updateDoc(doc(db, 'users', user.email), { ...profileData });
      setShowProfileSaveSuccess(true);
      setTimeout(() => setShowProfileSaveSuccess(false), 3000);
    } catch (error) { console.error("Error saving profile:", error); } 
    finally { setIsSavingProfile(false); }
  };
  
  const handleCopy = () => {
    if (!publicLink) return;
    navigator.clipboard.writeText(publicLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUpdateStatus = async (bookingId: string, status: BookingStatus) => {
    if (!user?.email) return;
    const bookingRef = doc(db, 'users', user.email, 'bookings', bookingId);
    try {
      await updateDoc(bookingRef, { status });
      if (status === 'accepted') {
        const acceptedBooking = bookings.find(b => b.id === bookingId);
        if (acceptedBooking) {
          fetch('/api/send-confirmation', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ownerEmail: user.email, ownerName: profileData.name || username,
              requesterEmail: acceptedBooking.email, requesterName: acceptedBooking.name,
              date: acceptedBooking.date, time: acceptedBooking.time, duration: acceptedBooking.duration,
              subject: acceptedBooking.subject, location: acceptedBooking.location,
            }),
          }).catch(apiError => console.error('Error sending confirmation email:', apiError));
        }
      }
    } catch (error) { console.error('Error updating booking status:', error); }
  };

  const openCancelModal = (booking: Booking) => { 
    setBookingToCancel(booking);
    // ✨ NEW AI FEATURE: Pre-fill cancellation note
    const formattedDate = format(new Date(booking.date), 'MMMM d');
    const formattedTime = format(parse(booking.time, 'HH:mm', new Date()), 'h:mm a');
    const suggestedNote = `Hi ${booking.name},\n\nUnfortunately, I need to cancel our meeting scheduled for ${formattedDate} at ${formattedTime}. Apologies for any inconvenience this may cause.\n\nPlease feel free to book another time through my link.\n\nBest,\n${profileData.name.split(' ')[0]}`;
    setCancellationNote(suggestedNote);
    setIsCancelModalOpen(true); 
  };
  const closeCancelModal = () => { setIsCancelModalOpen(false); setBookingToCancel(null); setCancellationNote(''); };
  const handleConfirmCancel = async () => {
    if (!user?.email || !bookingToCancel || !publicLink) return;
    setIsCancelling(true);
    const bookingRef = doc(db, 'users', user.email, 'bookings', bookingToCancel.id);
    try {
      await updateDoc(bookingRef, { status: 'canceled', cancellationNote: cancellationNote || '' });
      await fetch('/api/send-cancellation', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerName: profileData.name || username, requesterEmail: bookingToCancel.email,
          requesterName: bookingToCancel.name, date: bookingToCancel.date,
          time: bookingToCancel.time, subject: bookingToCancel.subject,
          cancellationNote: cancellationNote, rebookUrl: publicLink
        }),
      });
      closeCancelModal();
    } catch (error) { console.error('Error canceling booking:', error); } 
    finally { setIsCancelling(false); }
  };

  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => ({ key: format(addDays(new Date(), i), 'yyyy-MM-dd'), label: format(addDays(new Date(), i), 'EEEE, dd MMM') })), []);
  const acceptedBookingSlots = useMemo(() => { const set = new Set<string>(); bookings.filter(b => b.status === 'accepted').forEach(b => set.add(`${b.date}_${b.time}`)); return set; }, [bookings]);
  const isRangeBooked = useCallback((dayKey: string, slot: TimeRange): boolean => { if (!slot.start || !slot.end) return false; let start = parse(slot.start, 'HH:mm', new Date(dayKey)); const end = parse(slot.end, 'HH:mm', new Date(dayKey)); if (!isValid(start) || !isValid(end)) return false; while (isBefore(start, end)) { if (acceptedBookingSlots.has(`${dayKey}_${format(start, 'HH:mm')}`)) return true; start = new Date(start.getTime() + slot.interval * 60000); } return false; }, [acceptedBookingSlots]);
  const handleRangeChange = (dayKey: string, index: number, field: keyof TimeRange, value: string | number) => setAvailability(prev => ({ ...prev, [dayKey]: prev[dayKey]?.map((item, i) => i === index ? { ...item, [field]: value } : item) || [{ ...DEFAULT_RANGE, [field]: value }] }));
  const addRange = (dayKey: string) => setAvailability(prev => ({ ...prev, [dayKey]: [...(prev[dayKey] || []), { ...DEFAULT_RANGE }] }));
  const removeRange = (dayKey: string, index: number) => setAvailability(prev => { const updatedDay = prev[dayKey]?.filter((_, i) => i !== index); if (updatedDay && updatedDay.length > 0) return { ...prev, [dayKey]: updatedDay }; const { [dayKey]: _, ...rest } = prev; return rest; });
  const saveAvailability = async () => { if (!user?.email) return; const toSave = Object.keys(availability).reduce((acc, key) => { const valid = availability[key].filter(s => s.start && s.end); if (valid.length > 0) acc[key] = valid; return acc; }, {} as Availability); await setDoc(doc(db, 'users', user.email), { availability: toSave }, { merge: true }); alert('Availability saved!'); };
  
  // ✨ NEW AI FEATURE: Smartly copy last week's schedule
  const applyLastWeeksSchedule = () => {
    const newAvailability = { ...availability };
    days.slice(7).forEach(day => {
        // Only apply if the day in the upcoming week is empty
        if (!newAvailability[day.key] || newAvailability[day.key].length === 0) {
            const correspondingDayLastWeek = subDays(new Date(day.key), 7);
            const lastWeekKey = format(correspondingDayLastWeek, 'yyyy-MM-dd');
            if (availability[lastWeekKey]) {
                newAvailability[day.key] = availability[lastWeekKey];
            }
        }
    });
    setAvailability(newAvailability);
  };

  const scrollToSection = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleReviewPending = () => {
    setActiveTab('pending');
    setTimeout(() => {
      scrollToSection('booking-requests');
    }, 100);
  };

  if (isLoading) return <div className="flex h-screen items-center justify-center bg-slate-50"><p>Loading Dashboard...</p></div>;

  return (
    <>
      <CancellationModal isOpen={isCancelModalOpen} onClose={closeCancelModal} onConfirm={handleConfirmCancel} booking={bookingToCancel} note={cancellationNote} setNote={setCancellationNote} isCancelling={isCancelling} />
      <div className="bg-slate-50 min-h-screen">
        <header className="sticky top-0 z-40 bg-slate-50/80 backdrop-blur-lg border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center h-16">
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2.5"><BookUser className="text-blue-600"/> Meeteazy</h1>
            <button onClick={() => signOut(auth)} className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-red-600 px-3 py-2 rounded-lg hover:bg-red-50"><LogOut size={16}/> Sign Out</button>
          </div>
        </header>

        <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
          <div className="mb-8">
              <h2 className="text-3xl font-bold text-slate-800">Welcome back, {profileData.name?.split(' ')[0] || '...'}!</h2>
              <p className="text-slate-500 mt-1">Here's your summary at a glance.</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <StatCard title="Today's Meetings" value={dashboardStats.todaysAcceptedBookings.length} icon={<CalendarIconLucide />} />
              <StatCard title="Next Meeting" value={dashboardStats.nextMeeting ? `${format(parse(dashboardStats.nextMeeting.time, 'HH:mm', new Date()), 'h:mm a')}` : "None"} note={dashboardStats.nextMeeting ? `with ${dashboardStats.nextMeeting.name}` : "Enjoy your day!"} icon={<Clock />} />
              <StatCard title="Pending Requests" value={dashboardStats.pendingRequestsCount} icon={<UserIcon />} note={dashboardStats.pendingRequestsCount > 0 ? "Action required" : "All caught up"} />
              <div onClick={handleCopy} className="cursor-pointer"><StatCard title="Public Link" value={copied ? "Copied!" : "Copy Link"} note={`/u/${username}`} icon={copied ? <ClipboardCheck/> : <LinkIcon />} /></div>
          </div>
          
          {/* --- NEW: Share Buttons Section --- */}
          {username && publicLink && (
            <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm mb-8">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex-1 text-center sm:text-left">
                        <h3 className="font-bold text-slate-800">Share Your Public Link</h3>
                        <p className="text-sm text-slate-500">Let others book meetings with you easily.</p>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        {/* WhatsApp Button */}
                        <a
                            href={`https://api.whatsapp.com/send?text=Book%20a%20meeting%20with%20me%3A%20${encodeURIComponent(publicLink)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 sm:flex-none justify-center w-full flex items-center gap-2 bg-[#25D366] text-white px-4 py-2 rounded-lg font-semibold hover:bg-[#1DAE51] transition-colors shadow-sm"
                            aria-label="Share on WhatsApp"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.894 11.892-1.99 0-3.903-.52-5.586-1.456l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.89-5.451 0-9.887 4.434-9.889 9.884-.001 2.225.651 4.315 1.731 6.086l.474.854-1.021 3.75z"/></svg>
                            <span>WhatsApp</span>
                        </a>
                        {/* LinkedIn Button */}
                        <a
                            href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(publicLink)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 sm:flex-none justify-center w-full flex items-center gap-2 bg-[#0077B5] text-white px-4 py-2 rounded-lg font-semibold hover:bg-[#005E90] transition-colors shadow-sm"
                            aria-label="Share on LinkedIn"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M4.98 3.5c0 1.381-1.11 2.5-2.48 2.5s-2.48-1.119-2.48-2.5c0-1.38 1.11-2.5 2.48-2.5s2.48 1.12 2.48 2.5zm.02 4.5h-5v16h5v-16zm7.982 0h-4.968v16h4.969v-8.399c0-4.67 6.029-4.455 6.029 0v8.399h4.988v-10.131c0-7.88-8.922-7.593-11.018-3.714v-2.155z"/></svg>
                            <span>LinkedIn</span>
                        </a>
                    </div>
                </div>
            </div>
          )}

          <div className="mb-8">
            <SmartAssistant
                profileData={profileData}
                availability={availability}
                bookings={bookings}
                onScrollTo={scrollToSection}
                onReviewPending={handleReviewPending}
                onCancelBooking={openCancelModal}
            />
          </div>

          <div className="space-y-6">
            <CollapsibleSection id="booking-requests" title="Booking Requests" icon={<CalendarIconLucide size={22} />} summary={`${totalFilteredBookingsCount} total requests`} defaultOpen={true}>
              <nav className="p-1.5 bg-slate-100 rounded-lg flex items-center gap-1 overflow-x-auto mb-6">
                  {(['pending', 'accepted', 'declined', 'canceled', 'all'] as const).map(tab => {
                      const count = tab === 'all' ? bookings.length : (bookings.filter(b => b.status === tab).length);
                      return <button key={tab} onClick={() => setActiveTab(tab)} className={clsx('px-3 py-1.5 text-sm font-semibold rounded-md flex items-center gap-2 capitalize transition-colors whitespace-nowrap', activeTab === tab ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:bg-white/60')}>
                          {tab} <span className={clsx('px-2 rounded-full text-xs', activeTab === tab ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700')}>{count}</span>
                      </button>
                  })}
              </nav>
              {filteredBookings.length > 0 ? (
                <div className="space-y-4">
                  {filteredBookings.map(b => <BookingCard key={b.id} booking={b} onUpdateStatus={handleUpdateStatus} onCancel={openCancelModal} />)}
                  {totalFilteredBookingsCount > VISIBLE_BOOKINGS_LIMIT && (
                      <button onClick={() => setShowAllBookings(prev => !prev)} className="text-sm font-semibold text-blue-600 hover:underline w-full pt-2">
                          {showAllBookings ? 'Show Less' : `Show ${totalFilteredBookingsCount - VISIBLE_BOOKINGS_LIMIT} More`}
                      </button>
                  )}
                </div>
              ) : <p className="text-center text-slate-500 py-4">No {activeTab} requests found.</p>}
            </CollapsibleSection>
            
            <CollapsibleSection id="profile-section" title="Profile Editor" icon={<UserIcon size={22} />} summary="Manage your public information">
                {/* ✨ NEW AI FEATURE: Profile completeness nudge */}
                {showCompanyNudge && (
                    <div className="flex items-start gap-3 p-3 mb-6 bg-indigo-50 border border-indigo-200 rounded-lg">
                        <Building className="w-5 h-5 text-indigo-700 mt-0.5 shrink-0" />
                        <div className="flex-1">
                           <p className="text-sm text-indigo-800 font-medium">Add your company to build credibility. It increases booking confirmation rates.</p>
                           <p className="text-xs text-indigo-600">You can add it below.</p>
                        </div>
                         <button onClick={() => setShowCompanyNudge(false)} className="text-indigo-500 hover:text-indigo-800"><X size={16}/></button>
                    </div>
                )}
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><label className="block"><span className="text-sm font-medium text-slate-700">Name</span><input type="text" value={profileData.name} onChange={(e) => setProfileData({...profileData, name: e.target.value})} className="mt-1 block w-full border-slate-300 rounded-md shadow-sm"/></label><label className="block"><span className="text-sm font-medium text-slate-700">Role</span><input type="text" value={profileData.role} onChange={(e) => setProfileData({...profileData, role: e.target.value})} className="mt-1 block w-full border-slate-300 rounded-md shadow-sm"/></label></div>
                    <label className="block"><span className="text-sm font-medium text-slate-700">Company</span><input type="text" value={profileData.company} onChange={(e) => setProfileData({...profileData, company: e.target.value})} className="mt-1 block w-full border-slate-300 rounded-md shadow-sm"/></label>
                    <label className="flex items-center"><input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" checked={profileData.showContact} onChange={(e) => setProfileData({...profileData, showContact: e.target.checked})}/><span className="ml-3 text-sm font-medium text-slate-700">Show email on public profile</span></label>
                </div>
                <div className="mt-6 flex items-center justify-end">
                    {showProfileSaveSuccess && <p className="text-sm font-medium text-green-600 mr-4">✓ Saved!</p>}
                    <button onClick={saveProfile} disabled={isSavingProfile} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-blue-300">{isSavingProfile ? 'Saving...' : 'Save Profile'}</button>
                </div>
            </CollapsibleSection>

            <CollapsibleSection id="availability-section" title="Availability" icon={<BrainCircuit size={22} />} summary="Set your available hours for the next 14 days">
                 <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-3 p-3 mb-6 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <Info className="w-5 h-5 text-blue-700 mt-0.5 shrink-0" />
                      <p className="text-sm text-blue-800 flex-1">Define your weekly schedule. Booked slots will be automatically removed from public view.</p>
                    </div>
                    {/* ✨ NEW AI FEATURE: Availability helper */}
                    <button onClick={applyLastWeeksSchedule} className="flex-shrink-0 w-full sm:w-auto flex items-center justify-center gap-2 bg-white/70 text-blue-700 border border-blue-300/50 hover:border-blue-300 hover:bg-white px-3 py-1.5 text-xs font-semibold rounded-md transition-colors shadow-sm">
                        <Copy size={14} /> Apply Last Week's Schedule
                    </button>
                </div>
                <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2 -mr-2">
                {days.map(({ key, label }) => (
                    <div key={key}>
                        <h3 className="text-base font-semibold mb-3 text-slate-700">{label}</h3>
                        <div className="space-y-3">
                        {(availability[key] || []).map((slot, index) => {
                            const isBooked = isRangeBooked(key, slot);
                            return <div key={index} className={clsx("relative grid grid-cols-2 sm:flex items-center gap-2 flex-wrap p-3 rounded-lg", isBooked ? "bg-red-50" : "bg-slate-100")}><input type="time" value={slot.start || ''} onChange={e => handleRangeChange(key, index, 'start', e.target.value)} disabled={isBooked} className="border px-2 py-1.5 rounded-md w-full border-slate-300 disabled:bg-slate-200 disabled:cursor-not-allowed"/><input type="time" value={slot.end || ''} onChange={e => handleRangeChange(key, index, 'end', e.target.value)} disabled={isBooked} className="border px-2 py-1.5 rounded-md w-full border-slate-300 disabled:bg-slate-200 disabled:cursor-not-allowed"/><select value={slot.interval || 30} onChange={e => handleRangeChange(key, index, 'interval', parseInt(e.target.value))} disabled={isBooked} className="border px-2 py-1.5 rounded-md w-full sm:w-auto border-slate-300 disabled:bg-slate-200 disabled:cursor-not-allowed col-span-2 sm:col-span-1">{INTERVALS.map(val => <option key={val} value={val}>{val} min</option>)}</select>{isBooked ? <span className="text-xs font-bold text-red-700 uppercase">Booked</span> : <button onClick={() => removeRange(key, index)} className="text-red-500 hover:text-red-700 text-sm font-semibold ml-auto">Remove</button>}</div>;
                        })}
                        </div>
                        <button onClick={() => addRange(key)} className="text-blue-600 hover:underline text-sm mt-3 font-semibold">+ Add time range</button>
                    </div>
                ))}
                </div>
                <div className="mt-8 border-t border-slate-200 pt-6 flex justify-end">
                    <button onClick={saveAvailability} className="bg-green-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-green-700 transition-colors">Save Availability</button>
                </div>
            </CollapsibleSection>
          </div>
        </main>
      </div>
    </>
  )
}