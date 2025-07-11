// START OF FILE
// /app/dashboard/page.tsx
'use client';

// --- IMPORTS ---
// React and Next.js
import { useEffect, useState, useMemo, useCallback, ReactNode, Fragment, ChangeEvent, useRef, createContext, useContext } from 'react';
import { useRouter } from 'next/navigation';

// Firebase
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, getDoc, collection, query, onSnapshot, updateDoc, Timestamp, writeBatch, runTransaction, setDoc } from 'firebase/firestore';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

// Date Handling
import {
    addDays, isBefore, isToday, isTomorrow, isPast, getHours, subDays, addMinutes, isAfter,
    startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameMonth, addMonths, subMonths, differenceInHours, startOfWeek, startOfDay,
    parse
} from 'date-fns';
import { parseDate, parseTime, formatDate } from '@/app/utils/dateUtils';

// Utilities
import { v4 as uuidv4 } from 'uuid';
import { clsx } from 'clsx';
import DOMPurify from 'dompurify';
import * as ics from 'ics';


// UI Components
import { Disclosure, Transition, Menu } from '@headlessui/react';
import { QRCodeCanvas } from 'qrcode.react';

// Icons
import {
    AlertTriangle, BookUser, BrainCircuit, Calendar as CalendarIconLucide, Check, ChevronDown,
    ClipboardCheck, Clock, Info, Link as LinkIcon, LogOut, User as UserIcon, X,
    Coffee, Send, CalendarClock, Sparkles, Copy, Building,
    ChevronLeft, ChevronRight, Menu as MenuIcon,
    QrCode as QrCodeIcon, Download, BarChart2, Plus,
    Zap, FileCheck2, AlertCircle, Printer, Settings, Star, Mail, Phone, Calendar, Globe
} from 'lucide-react';


// --- TYPE DEFINITIONS ---
interface ProfileData {
    name: string;
    role: string;
    company: string;
    showContact: boolean;
    photoUrl?: string;
    bio?: string;
    focus?: string;
    linkedin?: string;
    twitter?: string;
    whatsapp?: string;
    website?: string;
    themeColor?: string;
    bufferTime?: number;
}

interface TimeRange {
    start: string;
    end: string;
    interval: number;
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
    id: string;
    requesterName: string;
    requesterEmail: string;
    requesterPhone?: string;
    subject: string;
    location?: string;
    date: string; // "yyyy-MM-dd"
    time: string; // "HH:mm"
    duration: number;
    status: 'pending' | 'accepted' | 'declined' | 'canceled' | 'arranged';
    createdAt: Timestamp;
    cancellationNote?: string;
    rescheduledAt?: Timestamp;
    meetingType?: 'discovery' | 'interview' | 'consultation' | 'follow-up' | 'personal';
    statusUpdatedAt?: Timestamp;
}

type ProfileFormErrors = Partial<Record<keyof ProfileData, string>>;

interface CollapsibleSectionProps {
    id?: string;
    title: string;
    icon: ReactNode;
    summary?: string;
    children: ReactNode;
    defaultOpen?: boolean;
}

interface SmartAssistantProps {
    profileData: ProfileData;
    availability: Availability;
    bookings: Booking[];
    onScrollTo: (id: string) => void;
    onReviewPending: () => void;
    onCancelBooking: (booking: Booking) => void;
    onReschedule: (booking: Booking) => void;
}

interface AvailabilityModalProps {
    isOpen: boolean;
    onClose: () => void;
    dayToEdit: Date | null;
    availability: Availability;
    isRangeBooked: (dayKey: string, slot: TimeRange) => boolean;
    handleRangeChange: (dayKey: string, index: number, field: keyof TimeRange, value: string | number) => void;
    addRange: (dayKey: string) => void;
    removeRange: (dayKey: string, index: number) => void;
    handleBlockChange: (dayKey: string, index: number, field: keyof Omit<TimeBlock, 'id'>, value: string) => void;
    addBlock: (dayKey: string) => void;
    removeBlock: (dayKey: string, index: number) => void;
}

interface AvailabilityCalendarProps {
    availability: Availability;
    openModal: (day: Date) => void;
    normalizeDayData: (dayData: any) => { ranges: TimeRange[], blocks: TimeBlock[] };
}


// --- CONSTANTS ---
const DEFAULT_RANGE = { start: '09:00', end: '17:00', interval: 30 };
const INTERVALS = [15, 30, 45, 60];
const BACK_TO_BACK_THRESHOLD = 3;
const BRAND_COLORS = ['#2563eb', '#059669', '#7c3aed', '#dc2626', '#ea580c', '#0891b2'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const URL_REGEX = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([\/\w .-]*)*\/?$/;
// ✅ FIX (Line 151): Changed `|` to `,` to create a valid string array.
const MEETING_TYPES: (Booking['meetingType'])[] = ['discovery', 'interview', 'consultation', 'follow-up', 'personal'];


// --- TOAST NOTIFICATION SYSTEM ---
interface ToastMessage {
    id: string;
    message: string;
    type: 'success' | 'error' | 'info';
}

interface ToastContextType {
    showToast: (message: string, type: ToastMessage['type']) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const ToastProvider = ({ children }: { children: ReactNode }) => {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    const showToast = (message: string, type: ToastMessage['type']) => {
        const id = uuidv4();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(toast => toast.id !== id));
        }, 4000);
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div className="fixed top-4 right-4 z-[100] space-y-2">
                {toasts.map(toast => (
                    <Toast key={toast.id} message={toast.message} type={toast.type} />
                ))}
            </div>
        </ToastContext.Provider>
    );
};

const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

const Toast = ({ message, type }: Omit<ToastMessage, 'id'>) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        setIsVisible(true);
        const hideTimer = setTimeout(() => setIsVisible(false), 3500);
        return () => clearTimeout(hideTimer);
    }, []);

    const config = {
        success: { icon: <Check size={20} />, barColor: 'bg-green-500' },
        error: { icon: <AlertCircle size={20} />, barColor: 'bg-red-500' },
        info: { icon: <Info size={20} />, barColor: 'bg-blue-500' },
    }[type];

    return (
        <div className={clsx(
            "flex items-center gap-4 w-full max-w-sm bg-white shadow-xl rounded-2xl p-4 border border-slate-200 transition-all duration-300 ease-out",
            isVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-10"
        )}>
            <div className={`text-white p-1.5 rounded-full ${config.barColor}`}>{config.icon}</div>
            <p className="flex-1 text-sm font-medium text-slate-800">{message}</p>
        </div>
    );
};


// --- HELPER COMPONENTS ---

// ✨ ENHANCED: StatCard with premium glassmorphism and entrance animations
const StatCard = ({ title, value, note, icon, index = 0 }: { title: string; value: string | number; note?: string; icon: ReactNode; index?: number }) => (
    <div
        className="bg-white/70 backdrop-blur-xl border border-white/50 shadow-xl shadow-slate-900/5 rounded-3xl p-6 flex items-start gap-4 transition-all duration-500 hover:shadow-2xl hover:bg-white/90 hover:-translate-y-2 hover:scale-105 group animate-fade-in-up"
        style={{ animationDelay: `${index * 100}ms` }}
    >
        <div className="bg-gradient-to-br from-slate-100 to-slate-200 p-4 rounded-2xl text-blue-600 transition-all duration-300 group-hover:scale-110 group-hover:bg-gradient-to-br group-hover:from-blue-600 group-hover:to-blue-700 group-hover:text-white shadow-lg">
            {icon}
        </div>
        <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-500 tracking-wide uppercase">{title}</p>
            <p className="text-3xl font-bold text-slate-900 truncate mt-1" style={{ fontFamily: "'Lexend', sans-serif" }}>{value}</p>
            {note && <p className="text-xs text-slate-500 mt-2 truncate">{note}</p>}
        </div>
    </div>
);

// ✨ ENHANCED: BarChart with smooth animations and better visual hierarchy
const BarChart = ({ data, title, gradient = 'from-blue-500 to-blue-600' }: { data: { label: string; value: number }[]; title: string; gradient?: string; }) => {
    const maxValue = useMemo(() => Math.max(...data.map(d => d.value), 1), [data]);

    return (
        <div className="bg-white/70 backdrop-blur-xl border border-white/50 shadow-xl shadow-slate-900/5 rounded-3xl p-8 h-full">
            <h4 className="text-lg font-bold text-slate-900 mb-8" style={{ fontFamily: "'Lexend', sans-serif" }}>{title}</h4>
            <div className="space-y-6">
                {data.map((item, index) => (
                    <div key={item.label} className="grid grid-cols-12 items-center gap-4 text-sm group">
                        <p className="text-slate-700 font-semibold truncate col-span-4">{item.label}</p>
                        <div className="col-span-8 bg-slate-200/70 rounded-full h-8 relative overflow-hidden">
                            <div
                                className={clsx("h-8 rounded-full flex items-center justify-end px-3 text-white font-bold transition-all duration-1000 ease-out bg-gradient-to-r group-hover:brightness-110 animate-expand-bar", gradient)}
                                style={{
                                    width: `${(item.value / maxValue) * 100}%`,
                                    animationDelay: `${index * 150}ms`
                                }}
                            >
                                <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">{item.value}</span>
                            </div>
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-700 font-bold group-hover:opacity-0 transition-opacity duration-300">{item.value}</span>
                        </div>
                    </div>
                ))}
                {data.length === 0 && (
                    <div className="text-center py-12">
                        <div className="text-slate-400 mb-4">
                            <BarChart2 size={48} className="mx-auto" />
                        </div>
                        <p className="text-sm text-slate-500 font-medium">No data available yet</p>
                    </div>
                )}
            </div>
        </div>
    );
};

// ✨ ENHANCED: SmartAssistant with breathing animation and refined layout
const SmartAssistant = ({
    profileData,
    availability,
    bookings,
    onScrollTo,
    onReviewPending,
    onCancelBooking,
    onReschedule,
}: SmartAssistantProps) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setIsVisible(true), 200);
        return () => clearTimeout(timer);
    }, []);

    const assistantState = useMemo(() => {
        const name = profileData.name?.split(' ')[0] || 'there';
        const greeting = `Hi ${name} 👋`;
        const suggestions: any[] = [];

        if (!profileData.name || !profileData.role) {
            suggestions.push({
                type: 'prompt', icon: <UserIcon size={18} />, title: "Complete your profile",
                text: "Add your name and role to make a great first impression.",
                actionText: "Go to Profile", action: () => onScrollTo('profile-section'), priority: 10,
            });
        }

        if (Object.keys(availability).length === 0) {
            suggestions.push({
                type: 'prompt', icon: <CalendarClock size={18} />, title: "Set your availability",
                text: "Define your schedule so people can book meetings with you.",
                actionText: "Set Availability", action: () => onScrollTo('availability-section'), priority: 9,
            });
        }

        const pendingBookings = bookings.filter(b => b.status === 'pending');
        if (pendingBookings.length > 0) {
            suggestions.push({
                type: 'prompt', icon: <Clock size={18} />, title: `You have ${pendingBookings.length} pending request${pendingBookings.length > 1 ? 's' : ''}!`,
                text: "Review them soon to keep your clients in the loop.",
                actionText: "Review Requests", action: onReviewPending, priority: 8,
            });
        }

        const acceptedBookings = bookings.filter(b => b.status === 'accepted');
        if (acceptedBookings.length > 5) {
            const timeCounts = acceptedBookings.reduce((acc: Record<string, number>, b) => {
                const hour = b.time.split(':')[0]; acc[hour] = (acc[hour] || 0) + 1; return acc;
            }, {});
            const popularHour = Object.entries(timeCounts).sort((a, b) => b[1] - a[1])[0];
            if (popularHour && popularHour[1] > 2) {
                const hour24 = parseInt(popularHour[0], 10);
                const displayTime = formatDate(parseTime(`${hour24}:00`), 'h a');
                suggestions.push({
                    type: 'insight', icon: <Zap size={18} />, title: "Booking Hotspot!",
                    text: `Your slots around ${displayTime} are popular. Consider adding more availability then.`,
                    actionText: "Review Availability", action: () => onScrollTo('availability-section'), priority: 6
                });
            }
        }

        const acceptedBookingsByDate = bookings
            .filter(b => b.status === 'accepted' && !isPast(parseDate(b.date)))
            .reduce((acc: Record<string, number>, b) => { acc[b.date] = (acc[b.date] || 0) + 1; return acc; }, {});

        const busyDay = Object.entries(acceptedBookingsByDate).find(([_, count]) => count >= BACK_TO_BACK_THRESHOLD);
        if (busyDay) {
            suggestions.push({
                type: 'insight', icon: <Sparkles size={18} />, title: "A heads-up on your schedule",
                text: `You have ${busyDay[1]} meetings on ${formatDate(parseDate(busyDay[0]), 'MMM d')}. Consider increasing your meeting intervals to add breathing room.`,
                actionText: "Review Availability", action: () => onScrollTo('availability-section'), priority: 5,
            });
        }

        const now = new Date();
        const allTodaysBookings = bookings.filter(b => b.status === 'accepted' && isToday(parseDate(b.date)))
            .sort((a, b) => a.time.localeCompare(b.time));

        const upcomingTodaysBookings = allTodaysBookings.filter(booking => {
            const meetingDateTime = parseTime(booking.time, parseDate(booking.date));
            return isAfter(meetingDateTime, now);
        });

        if (suggestions.length === 0 && allTodaysBookings.length === 0) {
            suggestions.push({
                type: 'info', icon: <Coffee size={18} />, title: "All clear for today!",
                text: "You have no meetings scheduled. A great day to plan ahead or take a break.", priority: 1,
            });
        }

        const primarySuggestion = suggestions.sort((a, b) => b.priority - a.priority)[0];
        return { greeting, allTodaysBookings, upcomingTodaysBookings, primarySuggestion };
    }, [profileData, availability, bookings, onScrollTo, onReviewPending]);

    const renderTimelineItemAction = (booking: Booking) => (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <button onClick={() => onCancelBooking(booking)} className="p-2 rounded-lg text-slate-500 hover:bg-red-100 hover:text-red-600 transition-colors" title="Cancel Meeting">
                <X size={16} />
            </button>
            <button onClick={() => onReschedule(booking)} className="p-2 rounded-lg text-slate-500 hover:bg-blue-100 hover:text-blue-600 transition-colors" title="Reschedule">
                <CalendarClock size={16} />
            </button>
            <a
                href={`mailto:${encodeURIComponent(booking.requesterEmail)}?subject=${encodeURIComponent(
                    `Reminder: Meeting at ${formatDate(parseTime(booking.time), 'h:mm a')}`
                )}&body=${encodeURIComponent(
                    `Hi ${booking.requesterName},\n\nJust a friendly reminder about our upcoming meeting today at ${formatDate(parseTime(booking.time), 'h:mm a')}.\n\nSubject: ${booking.subject}\n\nLooking forward to it!\n\nBest,\n${profileData.name}`
                )}`}
                className="p-2 rounded-lg text-slate-500 hover:bg-green-100 hover:text-green-600 transition-colors"
                title="Send Reminder"
                target="_blank"
                rel="noopener noreferrer"
            >
                <Send size={16} />
            </a>
        </div>
    );

    return (
        <div className={clsx(
            "bg-gradient-to-br from-blue-100/40 to-indigo-100/40 backdrop-blur-xl border border-white/60 rounded-3xl shadow-2xl shadow-slate-900/10 p-8 transition-all duration-700 ease-in-out animate-breathe",
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        )}>
            <div className="flex flex-col lg:flex-row items-start gap-8">
                <div className="bg-white/60 p-5 rounded-full text-blue-600 shrink-0 shadow-xl animate-pulse-soft">
                    <BrainCircuit size={40} />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-900 text-2xl lg:text-3xl" style={{ fontFamily: "'Lexend', sans-serif" }}>{assistantState.greeting}</h3>
                    {assistantState.allTodaysBookings.length > 0 ? (
                        <>
                            <p className="text-base text-slate-600 mt-3">
                                {assistantState.upcomingTodaysBookings.length > 0 ? (
                                    <>You have <span className="font-bold text-slate-900">{assistantState.upcomingTodaysBookings.length}</span> upcoming meeting{assistantState.upcomingTodaysBookings.length > 1 ? 's' : ''} on your schedule.</>
                                ) : (
                                    <>You had <span className="font-bold text-slate-900">{assistantState.allTodaysBookings.length}</span> meeting{assistantState.allTodaysBookings.length > 1 ? 's' : ''} today.</>
                                )}
                            </p>
                            {assistantState.upcomingTodaysBookings.length > 0 && (
                                <div className="mt-8 -ml-4 flow-root">
                                    <ul className="mb-0">
                                        {assistantState.upcomingTodaysBookings.map((booking, index) => (
                                            <li key={booking.id}>
                                                <div className="relative pb-8">
                                                    {index !== assistantState.upcomingTodaysBookings.length - 1 ? (
                                                        <span className="absolute left-6 top-6 -ml-px h-full w-0.5 bg-blue-200" aria-hidden="true" />
                                                    ) : null}
                                                    <div className="relative flex items-start space-x-5 group">
                                                        <div>
                                                            <div className="h-12 w-12 rounded-full flex items-center justify-center ring-8 ring-blue-100/50 bg-blue-500 shadow-lg">
                                                                <Clock size={20} className="text-white" />
                                                            </div>
                                                        </div>
                                                        <div className="min-w-0 flex-1 bg-white/80 border border-slate-200 rounded-2xl p-5 transition-all duration-300 hover:border-slate-300 hover:shadow-xl">
                                                            <div className="flex justify-between items-center">
                                                                <div className="min-w-0">
                                                                    <p className="text-sm font-semibold text-blue-600">{formatDate(parseTime(booking.time), 'h:mm a')}</p>
                                                                    <p className="font-bold text-slate-900 text-lg mt-1 truncate">{booking.subject}</p>
                                                                    <p className="text-sm text-slate-500">with {booking.requesterName}</p>
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
                            )}
                        </>
                    ) : (
                        assistantState.primarySuggestion && (
                            <div className="mt-6 bg-white/80 p-6 rounded-2xl border border-white/50 flex flex-col sm:flex-row items-start gap-5 shadow-xl">
                                <div className="text-blue-600 bg-blue-100 p-4 rounded-full mt-1 shrink-0">{assistantState.primarySuggestion.icon}</div>
                                <div className="min-w-0">
                                    <h4 className="font-bold text-slate-900 text-lg">{assistantState.primarySuggestion.title}</h4>
                                    <p className="text-sm text-slate-600 mt-2">{assistantState.primarySuggestion.text}</p>
                                    {(assistantState.primarySuggestion.type === 'prompt' || assistantState.primarySuggestion.type === 'insight') && (
                                        <button
                                            onClick={assistantState.primarySuggestion.action}
                                            className="mt-5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-6 py-3 text-sm font-semibold rounded-xl hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
                                        >
                                            {assistantState.primarySuggestion.actionText}
                                        </button>
                                    )}
                                </div>
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
    );
};

// ✨ ENHANCED: CollapsibleSection with smooth animations
const CollapsibleSection = ({ id, title, icon, summary, children, defaultOpen = false }: CollapsibleSectionProps) => (
    <Disclosure as="div" id={id} className="bg-white/70 backdrop-blur-xl border border-white/50 rounded-3xl shadow-xl shadow-slate-900/5" defaultOpen={defaultOpen}>
        {({ open }) => (
            <>
                <Disclosure.Button className="w-full flex justify-between items-center gap-4 p-6 text-left transition-colors duration-200 hover:bg-slate-50/70 rounded-t-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50">
                    <div className="flex items-center gap-5 min-w-0">
                        <div className="text-slate-500 bg-slate-100 p-4 rounded-2xl shadow-inner">{icon}</div>
                        <div className="min-w-0">
                            <h2 className="text-xl font-bold text-slate-900 truncate" style={{ fontFamily: "'Lexend', sans-serif" }}>{title}</h2>
                            {summary && <p className="text-sm text-slate-500 truncate mt-1">{summary}</p>}
                        </div>
                    </div>
                    <ChevronDown className={clsx("w-6 h-6 text-slate-500 transition-transform duration-300 shrink-0", open && "rotate-180")} />
                </Disclosure.Button>
                <Transition as={Fragment} enter="transition-all ease-in-out duration-500" enterFrom="opacity-0 max-h-0" enterTo="opacity-100 max-h-[5000px]" leave="transition-all ease-in-out duration-300" leaveFrom="opacity-100 max-h-[5000px]" leaveTo="opacity-0 max-h-0">
                    <Disclosure.Panel className="overflow-hidden">
                        {children}
                    </Disclosure.Panel>
                </Transition>
            </>
        )}
    </Disclosure>
);

// ✨ ENHANCED: StatusBadge with better visual hierarchy
const StatusBadge = ({ status }: { status: Booking['status'] }) => {
    const config = {
        pending: { icon: <Clock size={12} />, styles: 'bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-200' },
        accepted: { icon: <Check size={12} />, styles: 'bg-green-100 text-green-800 ring-1 ring-inset ring-green-200' },
        declined: { icon: <X size={12} />, styles: 'bg-red-100 text-red-800 ring-1 ring-inset ring-red-200' },
        canceled: { icon: <AlertTriangle size={12} />, styles: 'bg-slate-200 text-slate-800 ring-1 ring-inset ring-slate-300' },
        arranged: { icon: <Check size={12} />, styles: 'bg-blue-100 text-blue-800 ring-1 ring-inset ring-blue-200' },
    }[status] || { icon: <Info size={12} />, styles: 'bg-slate-200 text-slate-800' };

    return <span className={clsx('px-3 py-1.5 text-xs font-bold rounded-full capitalize inline-flex items-center gap-2 whitespace-nowrap', config.styles)}>{config.icon}{status}</span>
}

const AIMeetingSummary = ({ booking }: { booking: Booking }) => {
    const [summary, setSummary] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    const generateSummary = useCallback(() => {
        setIsGenerating(true);
        setTimeout(() => {
            const possibleKeywords = [booking.subject, ...(booking.meetingType ? [booking.meetingType] : []), (booking.requesterName || '').split(' ')[0]];
            const sanitizedSubject = DOMPurify.sanitize(booking.subject, { ALLOWED_TAGS: [] });
            const sanitizedName = DOMPurify.sanitize(booking.requesterName, { ALLOWED_TAGS: [] });
            const summaryText = `This is an AI-generated summary. The meeting, titled "${sanitizedSubject}", is scheduled with ${sanitizedName}. Key topics may include ${possibleKeywords.join(', ')}. The meeting is set for a duration of ${booking.duration} minutes. Action items will be determined during the call.`;
            setSummary(summaryText);
            setIsGenerating(false);
        }, 1500);
    }, [booking]);

    useEffect(() => {
        generateSummary();
    }, [generateSummary]);

    return (
        <div className="mt-5 p-5 bg-blue-50/70 border-l-4 border-blue-400 rounded-r-xl">
            <h5 className="font-semibold text-sm text-blue-800 mb-3 flex items-center gap-2">
                <Sparkles size={16} /> AI-Generated Summary
            </h5>
            {isGenerating && <div className="animate-pulse bg-slate-200 h-4 rounded mb-2"></div>}
            {!isGenerating && summary && <p className="text-sm text-slate-700 leading-relaxed">{summary}</p>}
        </div>
    );
};

// ✨ MAJOR ENHANCED: BookingCard with swipe indicators and refined touch interactions
const BookingCard = ({ booking, onUpdateStatus, onCancel, onReschedule, isSelected, onToggleSelect, isUpdating, onDownloadIcs, isDownloading }: { booking: Booking; onUpdateStatus: (id: string, status: Booking['status']) => void; onCancel: (booking: Booking) => void; onReschedule: (booking: Booking) => void; isSelected: boolean; onToggleSelect: (id: string) => void; isUpdating: boolean; onDownloadIcs: (booking: Booking) => void; isDownloading: boolean; }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const sanitizedSubject = useMemo(() => DOMPurify.sanitize(booking.subject || 'No Subject', { ALLOWED_TAGS: [] }), [booking.subject]);
    const sanitizedCancellationNote = useMemo(() => DOMPurify.sanitize(booking.cancellationNote || '', { ALLOWED_TAGS: ['br', 'p'] }), [booking.cancellationNote]);

    return (
        <div className={clsx(
            "border rounded-3xl bg-white transition-all duration-300 relative shadow-xl shadow-slate-900/5 overflow-hidden",
            isSelected ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 hover:shadow-2xl hover:-translate-y-1',
            isUpdating && 'opacity-50 pointer-events-none'
        )}>
            {isUpdating && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded-3xl z-10">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                </div>
            )}

            {/* Swipe Indicators for Mobile */}
            {booking.status === 'pending' && (
                <>
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-green-500 opacity-20 md:hidden">
                        <Check size={24} />
                        <span className="text-xs font-bold">Swipe →</span>
                    </div>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-red-500 opacity-20 md:hidden">
                        <X size={24} />
                        <span className="text-xs font-bold">← Swipe</span>
                    </div>
                </>
            )}

            <div className="p-6">
                <div className="flex items-start gap-5">
                    {booking.status === 'pending' && (
                        <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => onToggleSelect(booking.id)}
                            className="mt-2 h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 transition-all shrink-0"
                        />
                    )}
                    <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                            {/* Main Info */}
                            <div className="flex items-center gap-5 min-w-0">
                                <div className="flex flex-col text-center shrink-0 w-20">
                                    <span className="text-xl font-bold text-blue-600" style={{ fontFamily: "'Lexend', sans-serif" }}>
                                        {formatDate(parseTime(booking.time), 'h:mm')}
                                    </span>
                                    <span className="text-sm font-semibold text-blue-500 -mt-1">
                                        {formatDate(parseTime(booking.time), 'a')}
                                    </span>
                                </div>
                                <div className="w-px h-12 bg-slate-200 hidden sm:block"></div>
                                <div className="min-w-0">
                                    <p className="font-bold text-slate-900 text-lg truncate" title={sanitizedSubject}>{sanitizedSubject}</p>
                                    <p className="text-sm text-slate-500 truncate">with {booking.requesterName}</p>
                                </div>
                            </div>
                            {/* Status and Expander */}
                            <div className="flex items-center gap-4 self-start sm:self-center shrink-0 ml-auto sm:ml-0 pl-2">
                                <StatusBadge status={booking.status} />
                                <button
                                    onClick={() => setIsExpanded(!isExpanded)}
                                    className="flex items-center justify-center h-12 w-12 rounded-full hover:bg-slate-200/70 text-slate-500 transition-colors"
                                    aria-label={isExpanded ? 'Collapse' : 'Expand'}
                                >
                                    <ChevronDown size={20} className={clsx("transition-transform duration-300", isExpanded && "rotate-180")} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <Transition show={isExpanded} as={Fragment} enter="transition-all ease-in-out duration-300" enterFrom="opacity-0 max-h-0" enterTo="opacity-100 max-h-[600px]" leave="transition-all ease-in-out duration-200" leaveFrom="opacity-100 max-h-[600px]" leaveTo="opacity-0 max-h-0">
                <div className="border-t border-slate-200 p-6 space-y-6 overflow-hidden">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                        <div className="flex items-center gap-3">
                            <Mail size={16} className="text-slate-400 shrink-0" />
                            <strong className="font-semibold text-slate-600 w-20 shrink-0">Email:</strong>
                            <a href={`mailto:${encodeURIComponent(booking.requesterEmail)}`} className="text-blue-600 hover:underline truncate">{booking.requesterEmail}</a>
                        </div>
                        {booking.requesterPhone && (
                            <div className="flex items-center gap-3">
                                <Phone size={16} className="text-slate-400 shrink-0" />
                                <strong className="font-semibold text-slate-600 w-20 shrink-0">Phone:</strong>
                                <span className="text-slate-800 truncate">{booking.requesterPhone}</span>
                            </div>
                        )}
                        <div className="flex items-center gap-3">
                            <Globe size={16} className="text-slate-400 shrink-0" />
                            <strong className="font-semibold text-slate-600 w-20 shrink-0">Location:</strong>
                            <span className="text-slate-800 truncate">{booking.location || 'N/A'}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <Clock size={16} className="text-slate-400 shrink-0" />
                            <strong className="font-semibold text-slate-600 w-20 shrink-0">Duration:</strong>
                            <span className="text-slate-800">{booking.duration} minutes</span>
                        </div>
                        {booking.meetingType && (
                            <div className="flex items-center gap-3">
                                <Calendar size={16} className="text-slate-400 shrink-0" />
                                <strong className="font-semibold text-slate-600 w-20 shrink-0">Type:</strong>
                                <span className="text-slate-800 capitalize font-medium px-3 py-1 bg-slate-100 rounded-full">{booking.meetingType}</span>
                            </div>
                        )}
                    </div>

                    {isExpanded && <AIMeetingSummary booking={booking} />}

                    {booking.status === 'pending' && (
                        <div className="flex flex-wrap gap-4 pt-6 border-t border-slate-200/60">
                            <button
                                onClick={() => onUpdateStatus(booking.id, 'accepted')}
                                className="flex-1 sm:flex-none min-w-[140px] justify-center flex items-center gap-2 bg-green-600 text-white px-6 h-12 rounded-xl text-sm font-semibold hover:bg-green-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                            >
                                <Check size={16} />Accept
                            </button>
                            <button
                                onClick={() => onUpdateStatus(booking.id, 'declined')}
                                className="flex-1 sm:flex-none min-w-[140px] justify-center flex items-center gap-2 bg-red-600 text-white px-6 h-12 rounded-xl text-sm font-semibold hover:bg-red-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                            >
                                <X size={16} />Decline
                            </button>
                        </div>
                    )}

                    {booking.status === 'accepted' && (
                        <div className="flex flex-wrap gap-4 pt-6 border-t border-slate-200/60">
                            <button
                                onClick={(e) => { e.stopPropagation(); onReschedule(booking); }}
                                className="flex-1 sm:flex-none min-w-[140px] justify-center flex items-center gap-2 bg-blue-600 text-white px-6 h-12 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                            >
                                Reschedule
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); onCancel(booking); }}
                                className="flex-1 sm:flex-none min-w-[140px] justify-center flex items-center gap-2 bg-slate-700 text-white px-6 h-12 rounded-xl text-sm font-semibold hover:bg-slate-800 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); onDownloadIcs(booking); }}
                                disabled={isDownloading}
                                className="flex-1 sm:flex-none min-w-[140px] justify-center flex items-center gap-2 bg-slate-100 text-slate-700 px-6 h-12 rounded-xl text-sm font-semibold hover:bg-slate-200 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1 disabled:opacity-50 disabled:cursor-wait"
                            >
                                {isDownloading ? (
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-slate-700"></div>
                                ) : (
                                    <Download size={16} />
                                )}
                                {isDownloading ? 'Downloading...' : 'Download Calendar'}
                            </button>
                        </div>
                    )}

                    {booking.status === 'canceled' && booking.cancellationNote && (
                        <div className="mt-4 p-5 bg-yellow-50 border-l-4 border-yellow-400 rounded-r-xl">
                            <p className="text-sm font-semibold text-yellow-800">Your note:</p>
                            <div className="text-sm text-yellow-700 prose prose-sm" dangerouslySetInnerHTML={{ __html: sanitizedCancellationNote }}></div>
                        </div>
                    )}

                    <p className="text-xs text-slate-400 pt-4 border-t border-slate-100">
                        Requested on {booking.createdAt ? formatDate(booking.createdAt.toDate(), 'PPpp') : 'N/A'}
                        {booking.rescheduledAt && ` (Rescheduled on ${formatDate(booking.rescheduledAt.toDate(), 'PPp')})`}
                    </p>
                </div>
            </Transition>
        </div>
    )
}

const CancellationModal = ({ isOpen, onClose, onConfirm, booking, note, setNote, isCancelling }: { isOpen: boolean; onClose: () => void; onConfirm: () => void; booking: Booking | null; note: string; setNote: (note: string) => void; isCancelling: boolean }) => {
    if (!isOpen || !booking) return null;
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center p-4" aria-modal="true" role="dialog" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                <div className="p-6">
                    <h3 className="text-xl font-bold text-slate-900">Cancel Booking</h3>
                    <p className="mt-3 text-sm text-slate-500">Are you sure you want to cancel with <span className="font-semibold">{booking.requesterName}</span>?</p>
                    <div className="mt-5">
                        <label htmlFor="cancellationNote" className="block text-sm font-medium text-slate-700">Note (Optional)</label>
                        <textarea
                            id="cancellationNote"
                            rows={4}
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Let them know why..."
                            className="mt-2 block w-full border-gray-300 bg-white text-slate-900 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                </div>
                <div className="bg-gray-50 px-6 py-4 flex flex-col-reverse sm:flex-row-reverse gap-3 rounded-b-2xl">
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={isCancelling}
                        className="w-full sm:w-auto justify-center rounded-xl border-transparent shadow-sm px-6 h-12 bg-red-600 text-base font-medium text-white hover:bg-red-700 disabled:bg-red-300"
                    >
                        {isCancelling ? 'Cancelling...' : 'Yes, Cancel'}
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isCancelling}
                        className="w-full sm:w-auto justify-center rounded-xl border-gray-300 shadow-sm px-6 h-12 bg-white text-base font-medium text-slate-700 hover:bg-gray-50"
                    >
                        Keep Booking
                    </button>
                </div>
            </div>
        </div>
    )
}

const RescheduleModal = ({ isOpen, onClose, onConfirm, booking, availableSlots, newBookingTime, setNewBookingTime, isRescheduling, error }: { isOpen: boolean; onClose: () => void; onConfirm: () => void; booking: Booking | null; availableSlots: string[]; newBookingTime: string; setNewBookingTime: (time: string) => void; isRescheduling: boolean; error: string | null; }) => {
    const [displaySlots, setDisplaySlots] = useState<string[]>([]);
    const [showAddSlotForm, setShowAddSlotForm] = useState(false);
    const [tempSlot, setTempSlot] = useState({ start: '09:00', end: '10:00', interval: 30 });

    useEffect(() => { if (isOpen) { setDisplaySlots(availableSlots); setShowAddSlotForm(false); } }, [isOpen, availableSlots]);

    const handleAddTemporarySlot = () => {
        if (!tempSlot.start || !tempSlot.end || !booking) return;
        const generatedSlots: string[] = [];
        let currentTime = parseTime(tempSlot.start, parseDate(booking.date));
        const endTime = parseTime(tempSlot.end, parseDate(booking.date));

        while (isBefore(currentTime, endTime)) {
            const timeStr = formatDate(currentTime, 'HH:mm');
            generatedSlots.push(timeStr);
            currentTime = addMinutes(currentTime, tempSlot.interval);
        }
        if (generatedSlots.length > 0) {
            const allSlots = [...new Set([...displaySlots, ...generatedSlots])].sort((a, b) => a.localeCompare(b));
            setDisplaySlots(allSlots);
            setNewBookingTime(allSlots.includes(newBookingTime) ? newBookingTime : allSlots[0]);
        }
        setShowAddSlotForm(false);
    };

    if (!isOpen || !booking) return null;
    const showDropdown = displaySlots.length > 0;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center p-4" aria-modal="true" role="dialog" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                <div className="p-6">
                    <h3 className="text-xl font-bold text-slate-900">Reschedule Booking</h3>
                    <p className="mt-3 text-sm text-slate-500">Select a new time for your meeting with <span className="font-semibold">{booking.requesterName}</span> on <span className="font-semibold">{formatDate(parseDate(booking.date), 'EEEE, MMM d')}</span>.</p>
                    <div className="mt-5">
                        <label htmlFor="newBookingTime" className="block text-sm font-medium text-slate-700">New Time</label>
                        {showDropdown ? (
                            <select
                                id="newBookingTime"
                                value={newBookingTime}
                                onChange={(e) => setNewBookingTime(e.target.value)}
                                className="mt-2 block w-full h-12 border-gray-300 bg-white text-slate-900 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500"
                            >
                                {displaySlots.map(slot => (<option key={slot} value={slot}>{formatDate(parseTime(slot), 'h:mm a')}</option>))}
                            </select>
                        ) : (
                            <div className="mt-3 space-y-3">
                                <p className="text-sm text-slate-500 bg-gray-100 p-4 rounded-xl text-center">No other available time slots for this day.</p>
                                {!showAddSlotForm && (
                                    <button
                                        onClick={() => setShowAddSlotForm(true)}
                                        className="w-full flex justify-center items-center gap-2 px-4 h-12 bg-blue-100 text-blue-700 text-sm font-semibold rounded-xl hover:bg-blue-200 transition-colors"
                                    >
                                        + Add New Slot
                                    </button>
                                )}
                            </div>
                        )}
                        {showAddSlotForm && (
                            <Transition show={showAddSlotForm} as={Fragment} enter="transition-all ease-in-out duration-300" enterFrom="opacity-0 max-h-0" enterTo="opacity-100 max-h-96" leave="transition-all ease-in-out duration-200" leaveFrom="opacity-100 max-h-96" leaveTo="opacity-0 max-h-0">
                                <div className="mt-4 p-4 border border-gray-200 rounded-xl bg-gray-50 space-y-4 overflow-hidden">
                                    <p className="text-sm font-medium text-slate-800">Create a temporary time range</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs font-medium text-slate-600">Start</label>
                                            <input
                                                type="time"
                                                value={tempSlot.start}
                                                onChange={e => setTempSlot(p => ({ ...p, start: e.target.value }))}
                                                className="mt-1 w-full h-10 border-gray-300 bg-white text-slate-900 rounded-lg shadow-sm text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-slate-600">End</label>
                                            <input
                                                type="time"
                                                value={tempSlot.end}
                                                onChange={e => setTempSlot(p => ({ ...p, end: e.target.value }))}
                                                className="mt-1 w-full h-10 border-gray-300 bg-white text-slate-900 rounded-lg shadow-sm text-sm"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-slate-600">Interval</label>
                                        <select
                                            value={tempSlot.interval}
                                            onChange={e => setTempSlot(p => ({ ...p, interval: parseInt(e.target.value, 10) }))}
                                            className="mt-1 w-full h-10 border-gray-300 bg-white text-slate-900 rounded-lg shadow-sm text-sm"
                                        >
                                            {INTERVALS.map(val => <option key={val} value={val}>{val} min</option>)}
                                        </select>
                                    </div>
                                    <div className="flex justify-end">
                                        <button
                                            onClick={handleAddTemporarySlot}
                                            className="px-4 h-10 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700"
                                        >
                                            Add Slot
                                        </button>
                                    </div>
                                </div>
                            </Transition>
                        )}
                    </div>
                    {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
                </div>
                <div className="bg-gray-50 px-6 py-4 flex flex-col-reverse sm:flex-row-reverse gap-3 rounded-b-2xl">
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={isRescheduling || !newBookingTime}
                        className="w-full sm:w-auto justify-center rounded-xl border-transparent shadow-sm px-6 h-12 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed"
                    >
                        {isRescheduling ? 'Rescheduling...' : 'Confirm Reschedule'}
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isRescheduling}
                        className="w-full sm:w-auto justify-center rounded-xl border-gray-300 shadow-sm px-6 h-12 bg-white text-base font-medium text-slate-700 hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    )
}

const AvailabilityModal = ({
    isOpen,
    onClose,
    dayToEdit,
    availability,
    isRangeBooked,
    handleRangeChange,
    addRange,
    removeRange,
    handleBlockChange,
    addBlock,
    removeBlock
}: AvailabilityModalProps) => {
    if (!isOpen || !dayToEdit) return null;

    const dayKey = formatDate(dayToEdit, 'yyyy-MM-dd');
    const dayLabel = formatDate(dayToEdit, 'PPPP');

    const dayData = useMemo(() => {
        const rawDayData = availability[dayKey];
        if (Array.isArray(rawDayData)) {
            return { ranges: rawDayData, blocks: [] };
        } else if (typeof rawDayData === 'object' && rawDayData !== null) {
            return {
                ranges: Array.isArray(rawDayData.ranges) ? rawDayData.ranges : [],
                blocks: Array.isArray(rawDayData.blocks) ? rawDayData.blocks : [],
            };
        }
        return { ranges: [], blocks: [] };
    }, [availability, dayKey]);

    return (
        <Transition.Root show={isOpen} as={Fragment}>
            <div className="relative z-50" role="dialog" aria-modal="true">
                <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity" />
                </Transition.Child>
                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4 text-center">
                        <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                            <div className="w-full max-w-2xl transform overflow-hidden rounded-3xl bg-white text-left align-middle shadow-2xl transition-all">
                                <div className="p-6">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="text-xl font-bold leading-6 text-slate-900">Edit Availability</h3>
                                            <p className="mt-1 text-sm text-slate-500">{dayLabel}</p>
                                        </div>
                                        <button onClick={onClose} className="p-2 rounded-full text-slate-400 hover:bg-gray-100 hover:text-slate-600">
                                            <X size={20} />
                                        </button>
                                    </div>
                                </div>

                                <div className="max-h-[60vh] overflow-y-auto px-6 pb-4 space-y-8">
                                    <section>
                                        <h4 className="text-base font-semibold text-slate-800 mb-4">Available Time Ranges</h4>
                                        <div className="space-y-4">
                                            {dayData.ranges.map((slot, index) => {
                                                const isBooked = isRangeBooked(dayKey, slot);
                                                return (
                                                    <div key={index} className={clsx("relative grid grid-cols-1 sm:grid-cols-4 items-center gap-y-3 sm:gap-x-3 p-4 rounded-xl", isBooked ? "bg-red-50" : "bg-gray-50 border border-gray-200")}>
                                                        <input
                                                            type="time"
                                                            value={slot.start || ''}
                                                            onChange={e => handleRangeChange(dayKey, index, 'start', e.target.value)}
                                                            disabled={isBooked}
                                                            className="h-12 border px-3 py-2 rounded-xl w-full border-gray-300 bg-white disabled:bg-gray-200 disabled:cursor-not-allowed text-sm"
                                                        />
                                                        <input
                                                            type="time"
                                                            value={slot.end || ''}
                                                            onChange={e => handleRangeChange(dayKey, index, 'end', e.target.value)}
                                                            disabled={isBooked}
                                                            className="h-12 border px-3 py-2 rounded-xl w-full border-gray-300 bg-white disabled:bg-gray-200 disabled:cursor-not-allowed text-sm"
                                                        />
                                                        <select
                                                            value={slot.interval || 30}
                                                            onChange={e => handleRangeChange(dayKey, index, 'interval', parseInt(e.target.value, 10))}
                                                            disabled={isBooked}
                                                            className="h-12 border px-3 py-2 rounded-xl w-full border-gray-300 bg-white disabled:bg-gray-200 disabled:cursor-not-allowed text-sm"
                                                        >
                                                            {INTERVALS.map(val => <option key={val} value={val}>{val} min</option>)}
                                                        </select>
                                                        <div className="flex justify-end h-12 items-center">
                                                            {isBooked
                                                                ? <span className="text-xs font-bold text-red-700 uppercase">Booked</span>
                                                                : <button onClick={() => removeRange(dayKey, index)} className="text-red-500 hover:text-red-700 text-sm font-semibold">Remove</button>
                                                            }
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            <button
                                                onClick={() => addRange(dayKey)}
                                                className="w-full text-center h-14 border-2 border-dashed border-gray-300 text-slate-500 hover:border-blue-500 hover:text-blue-600 rounded-xl text-sm font-semibold transition-colors"
                                            >
                                                + Add Available Range
                                            </button>
                                        </div>
                                    </section>

                                    <section>
                                        <h4 className="text-base font-semibold text-slate-800 mb-4">Blocked-Off Time</h4>
                                        <div className="space-y-4">
                                            {dayData.blocks.map((block, index) => (
                                                <div key={block.id} className="relative grid grid-cols-1 sm:grid-cols-3 items-center gap-y-3 sm:gap-x-3 p-4 rounded-xl bg-gray-50 border border-gray-200">
                                                    <input
                                                        type="text"
                                                        placeholder="e.g., Lunch"
                                                        value={block.title}
                                                        onChange={e => handleBlockChange(dayKey, index, 'title', e.target.value)}
                                                        className="h-12 border px-3 py-2 rounded-xl w-full border-gray-300 bg-white text-sm"
                                                    />
                                                    <div className="grid grid-cols-2 gap-3 col-span-1 sm:col-span-2">
                                                        <input
                                                            type="time"
                                                            value={block.startTime}
                                                            onChange={e => handleBlockChange(dayKey, index, 'startTime', e.target.value)}
                                                            className="h-12 border px-3 py-2 rounded-xl w-full border-gray-300 bg-white text-sm"
                                                        />
                                                        <div className="flex items-center gap-3">
                                                            <input
                                                                type="time"
                                                                value={block.endTime}
                                                                onChange={e => handleBlockChange(dayKey, index, 'endTime', e.target.value)}
                                                                className="h-12 border px-3 py-2 rounded-xl w-full border-gray-300 bg-white text-sm"
                                                            />
                                                            <button
                                                                onClick={() => removeBlock(dayKey, index)}
                                                                className="text-red-500 hover:text-red-700 shrink-0"
                                                                title="Remove Block"
                                                            >
                                                                <X size={18} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                            <button
                                                onClick={() => addBlock(dayKey)}
                                                className="w-full text-center h-14 border-2 border-dashed border-gray-300 text-slate-500 hover:border-orange-500 hover:text-orange-600 rounded-xl text-sm font-semibold transition-colors"
                                            >
                                                + Add Time Block
                                            </button>
                                        </div>
                                    </section>
                                </div>

                                <div className="bg-gray-50 px-6 py-4 flex justify-end mt-6 rounded-b-3xl">
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="rounded-xl border border-transparent shadow-sm px-8 h-12 bg-blue-600 text-base font-medium text-white hover:bg-blue-700"
                                    >
                                        Done
                                    </button>
                                </div>
                            </div>
                        </Transition.Child>
                    </div>
                </div>
            </div>
        </Transition.Root>
    );
};

// ✨ ENHANCED: AnalyticsDashboard with improved visual hierarchy and mobile responsiveness
const AnalyticsDashboard = ({ bookings }: { bookings: Booking[] }) => {
    const analyticsData = useMemo(() => {
        if (bookings.length === 0) return null;

        const getSafeDate = (timestamp: any): Date | null => {
            if (!timestamp) return null;
            if (typeof timestamp.toDate === 'function') {
                return timestamp.toDate();
            }
            if (typeof timestamp.seconds === 'number') {
                return new Date(timestamp.seconds * 1000);
            }
            const date = new Date(timestamp);
            return isNaN(date.getTime()) ? null : date;
        };

        const statusCounts = bookings.reduce((acc: Record<string, number>, b) => { acc[b.status] = (acc[b.status] || 0) + 1; return acc; }, {});
        const acceptedCount = statusCounts.accepted || 0;
        const consideredForConversion = (statusCounts.accepted || 0) + (statusCounts.declined || 0) + (statusCounts.canceled || 0);
        const conversionRate = consideredForConversion > 0 ? Math.round((acceptedCount / consideredForConversion) * 100) : 0;

        const acceptedBookings = bookings.filter(b => b.status === 'accepted');

        const peakHours = acceptedBookings.reduce((acc: Record<string, number>, b) => {
            const hour = formatDate(parseTime(b.time), 'ha');
            acc[hour] = (acc[hour] || 0) + 1;
            return acc;
        }, {});

        const popularMeetingTypes = acceptedBookings.reduce((acc: Record<string, number>, b) => {
            const type = b.meetingType || 'uncategorized';
            acc[type] = (acc[type] || 0) + 1;
            return acc;
        }, {});

        const avgMeetingDuration = acceptedBookings.length > 0
            ? Math.round(acceptedBookings.reduce((sum, b) => sum + b.duration, 0) / acceptedBookings.length)
            : 0;

        const responseTimes = bookings
            .filter(b => b.status !== 'pending' && b.statusUpdatedAt && b.createdAt)
            .map(b => {
                const updatedAt = getSafeDate(b.statusUpdatedAt);
                const createdAt = getSafeDate(b.createdAt);
                return updatedAt && createdAt ? differenceInHours(updatedAt, createdAt) : 0;
            })
            .filter(h => h >= 0);

        const avgResponseTime = responseTimes.length > 0
            ? Math.round(responseTimes.reduce((sum, h) => sum + h, 0) / responseTimes.length)
            : 0;

        const clientEmails = acceptedBookings.map(b => b.requesterEmail);
        const uniqueClients = new Set(clientEmails).size;
        const repeatClientsCount = clientEmails.length - uniqueClients;

        const clientLeaderboardData = Object.entries(clientEmails.reduce((acc: Record<string, number>, email) => { acc[email] = (acc[email] || 0) + 1; return acc; }, {}))
            .map(([email, count]) => ({ email, count })).sort((a, b) => b.count - a.count).slice(0, 5);

        return {
            conversionRate,
            peakHours: Object.entries(peakHours).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 5),
            popularMeetingTypes: Object.entries(popularMeetingTypes).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 5),
            avgMeetingDuration,
            avgResponseTime,
            repeatClientRate: uniqueClients > 0 ? Math.round((repeatClientsCount / uniqueClients) * 100) : 0,
            clientLeaderboard: clientLeaderboardData,
        };
    }, [bookings]);

    if (!analyticsData) {
        return (
            <div className="border-t border-slate-200/80 p-8 text-center">
                <div className="text-slate-400 mb-6">
                    <BarChart2 size={64} className="mx-auto" />
                </div>
                <p className="text-slate-500 font-medium text-lg">Not enough data for analytics yet</p>
                <p className="text-slate-400 text-sm mt-2">Share your link to get some bookings!</p>
            </div>
        );
    }

    const { conversionRate, peakHours, popularMeetingTypes, avgMeetingDuration, avgResponseTime, repeatClientRate, clientLeaderboard } = analyticsData;

    return (
        <div className="border-t border-slate-200/80 p-6 sm:p-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard index={0} title="Conversion Rate" value={`${conversionRate}%`} note="Accepted vs. all resolved" icon={<Check />} />
                <StatCard index={1} title="Avg. Response Time" value={`${avgResponseTime} hrs`} note="From pending to decision" icon={<Clock />} />
                <StatCard index={2} title="Avg. Meeting Duration" value={`${avgMeetingDuration} min`} icon={<CalendarClock />} />
                <StatCard index={3} title="Repeat Client Rate" value={`${repeatClientRate}%`} note="Clients with >1 booking" icon={<UserIcon />} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <BarChart data={peakHours} title="Peak Booking Hours" gradient="from-green-400 to-emerald-500" />
                <BarChart data={popularMeetingTypes} title="Popular Meeting Types" gradient="from-indigo-400 to-purple-500" />
            </div>

            <div className="grid grid-cols-1 gap-8">
                <div className="bg-white/70 backdrop-blur-xl border border-white/50 shadow-xl shadow-slate-900/5 rounded-3xl p-8">
                    <h4 className="text-lg font-bold text-slate-900 mb-6" style={{ fontFamily: "'Lexend', sans-serif" }}>Top Clients</h4>
                    <ul className="space-y-4">
                        {clientLeaderboard.map(({ email, count }, index) => (
                            <li key={email} className="flex items-center justify-between text-sm hover:bg-slate-100/50 p-3 -m-3 rounded-xl transition-colors">
                                <div className="flex items-center gap-5 min-w-0">
                                    <span className="font-bold text-slate-400 w-6 text-center text-lg">{index + 1}</span>
                                    <p className="text-slate-700 font-medium truncate">{email}</p>
                                </div>
                                <p className="font-bold text-slate-900 shrink-0">{count} booking{count > 1 && 's'}</p>
                            </li>
                        ))}
                        {clientLeaderboard.length === 0 && (
                            <div className="text-center py-12">
                                <div className="text-slate-400 mb-4">
                                    <Star size={48} className="mx-auto" />
                                </div>
                                <p className="text-sm text-slate-500 font-medium">No repeat clients yet</p>
                            </div>
                        )}
                    </ul>
                </div>
            </div>
        </div>
    );
};


// --- MAIN DASHBOARD PAGE COMPONENT ---
export default function DashboardPageWrapper() {
    return (
        <ToastProvider>
            <DashboardPage />
        </ToastProvider>
    )
}

function DashboardPage() {
    const { showToast } = useToast();
    const router = useRouter();

    // State Hooks
    const [user, setUser] = useState<User | null>(null);
    const [username, setUsername] = useState<string>('');
    const [availability, setAvailability] = useState<Availability>({});
    const [profileData, setProfileData] = useState<ProfileData>({
        name: '', role: '', company: '', showContact: false, photoUrl: '',
        bio: '', focus: '', linkedin: '', twitter: '', whatsapp: '', website: '', themeColor: BRAND_COLORS[0],
        bufferTime: 0,
    });
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<Booking['status'] | 'all'>('pending');
    const [copied, setCopied] = useState(false);

    // Profile State
    const [isSavingProfile, setIsSavingProfile] = useState(false);
    const [showProfileSaveSuccess, setShowProfileSaveSuccess] = useState(false);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [initialPhotoUrl, setInitialPhotoUrl] = useState<string | null>(null);
    const [imageError, setImageError] = useState<string | null>(null);
    const [profileErrors, setProfileErrors] = useState<ProfileFormErrors>({});

    // Availability State
    const [isAvailModalOpen, setIsAvailModalOpen] = useState(false);
    const [dayToEdit, setDayToEdit] = useState<Date | null>(null);

    // Booking Actions State
    const [updatingBookingId, setUpdatingBookingId] = useState<string | null>(null);
    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
    const [bookingToCancel, setBookingToCancel] = useState<Booking | null>(null);
    const [cancellationNote, setCancellationNote] = useState('');
    const [isCancelling, setIsCancelling] = useState(false);
    const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
    const [bookingToReschedule, setBookingToReschedule] = useState<Booking | null>(null);
    const [availableSlots, setAvailableSlots] = useState<string[]>([]);
    const [newBookingTime, setNewBookingTime] = useState('');
    const [isRescheduling, setIsRescheduling] = useState(false);
    const [rescheduleError, setRescheduleError] = useState<string | null>(null);
    const [rescheduleSuccessMessage, setRescheduleSuccessMessage] = useState('');
    const [selectedBookings, setSelectedBookings] = useState<string[]>([]);
    const [isBatchUpdating, setIsBatchUpdating] = useState(false);
    const [isDownloading, setIsDownloading] = useState<string | null>(null);

    // Printing State
    const [isPrinting, setIsPrinting] = useState(false);

    const normalizeDayData = useCallback((dayData: any): { ranges: TimeRange[], blocks: TimeBlock[] } => {
        if (Array.isArray(dayData)) {
            return { ranges: dayData, blocks: [] };
        } else if (typeof dayData === 'object' && dayData !== null) {
            return {
                ranges: Array.isArray(dayData.ranges) ? dayData.ranges : [],
                blocks: Array.isArray(dayData.blocks) ? dayData.blocks : [],
            };
        }
        return { ranges: [], blocks: [] };
    }, []);

    useEffect(() => {
        let userUnsubscribe: (() => void) | null = null;
        let bookingsUnsubscribe: (() => void) | null = null;

        const authUnsubscribe = onAuthStateChanged(auth, (currentUser) => {
            if (userUnsubscribe) userUnsubscribe();
            if (bookingsUnsubscribe) bookingsUnsubscribe();

            if (currentUser?.email) {
                setUser(currentUser);
                const userRef = doc(db, 'users', currentUser.email);

                userUnsubscribe = onSnapshot(userRef, (docSnap) => {
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        if (!data.username) {
                            router.push('/onboarding');
                            return;
                        }
                        setUsername(data.username || '');
                        const newProfileData: ProfileData = {
                            name: data.name || currentUser.displayName || '',
                            role: data.role || '',
                            company: data.company || '',
                            showContact: !!data.showContact,
                            photoUrl: data.photoUrl, // Keep it as string | undefined
                            bio: data.bio || '',
                            focus: data.focus || '',
                            linkedin: data.linkedin || '',
                            twitter: data.twitter || '',
                            whatsapp: data.whatsapp || '',
                            website: data.website || '',
                            themeColor: data.themeColor || BRAND_COLORS[0],
                            bufferTime: data.bufferTime || 0,
                        };
                        setProfileData(newProfileData);
                        setAvailability(data.availability || {});
                        // FIX: Use '?? null' to prevent passing 'undefined' to the state setter.
                        setImagePreview(newProfileData.photoUrl ?? null);
                        setInitialPhotoUrl(newProfileData.photoUrl ?? null);
                    } else {
                        router.push('/onboarding');
                    }
                }, (error) => {
                    console.error("Error listening to user data:", error);
                    setIsLoading(false);
                });

                const bookingsRef = collection(db, 'users', currentUser.email, 'bookings');
                const bookingsQuery = query(bookingsRef);

                bookingsUnsubscribe = onSnapshot(bookingsQuery, (snapshot) => {
                    const fetchedBookings = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Booking));
                    setBookings(fetchedBookings);
                    setIsLoading(false);
                }, (error) => {
                    console.error("Error listening to bookings:", error);
                    setIsLoading(false);
                });

            } else {
                router.push('/signin');
            }
        });

        return () => {
            authUnsubscribe();
            if (userUnsubscribe) userUnsubscribe();
            if (bookingsUnsubscribe) bookingsUnsubscribe();
        };
    }, [router]);

    useEffect(() => {
        const currentImagePreview = imagePreview;
        return () => {
            if (currentImagePreview && currentImagePreview.startsWith('blob:')) {
                URL.revokeObjectURL(currentImagePreview);
            }
        };
    }, [imagePreview]);

    useEffect(() => {
        if (isPrinting) {
            window.print();
            setIsPrinting(false);
        }
    }, [isPrinting]);

    const handleDownloadIcs = (booking: Booking) => {
        if (!user?.email || !profileData.name) {
            showToast('Your profile must be loaded to create calendar events.', 'error');
            return;
        }

        setIsDownloading(booking.id);

        // Using a setTimeout to allow the UI to update with the loading state first
        setTimeout(() => {
            try {
                const { date, time, duration, subject, location, requesterName, requesterEmail } = booking;

                const startDateTime = parseTime(time, parseDate(date));

                const event: ics.EventAttributes = {
                    start: [startDateTime.getFullYear(), startDateTime.getMonth() + 1, startDateTime.getDate(), startDateTime.getHours(), startDateTime.getMinutes()],
                    duration: { minutes: duration },
                    title: subject,
                    description: `Meeting with ${requesterName}.\n\nDetails:\n- Requester: ${requesterName} (${requesterEmail})\n- Location: ${location || 'Virtual Meeting'}`,
                    location: location || 'Virtual Meeting',
                    status: 'CONFIRMED',
                    // ✅ FIX (Line 1374): Coalesce null email to undefined for ICS compatibility.
                    organizer: { name: profileData.name, email: user.email ?? undefined },
                    attendees: [
                        // ✅ FIX (Line 1376 area): Coalesce null email to undefined for ICS compatibility.
                        { name: profileData.name, email: user.email ?? undefined, rsvp: true, partstat: 'ACCEPTED', role: 'CHAIR' },
                        { name: requesterName, email: requesterEmail, rsvp: true, partstat: 'NEEDS-ACTION', role: 'REQ-PARTICIPANT' }
                    ]
                };

                ics.createEvent(event, (error, value) => {
                    if (error) {
                        console.error("ICS Generation Error:", error);
                        showToast('Failed to create calendar file.', 'error');
                        setIsDownloading(null);
                        return;
                    }

                    const blob = new Blob([value], { type: 'text/calendar;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    const safeSubject = subject.replace(/[^a-z0-9]/gi, '_').toLowerCase();
                    link.setAttribute('download', `meeting_${safeSubject}.ics`);

                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);

                    showToast('Calendar event downloaded!', 'success');
                    setIsDownloading(null);
                });
            } catch (err) {
                console.error("Download ICS Error:", err);
                showToast('An unexpected error occurred while preparing the file.', 'error');
                setIsDownloading(null);
            }
        }, 50);
    };


    const smartGreeting = useMemo((): string => {
        const name = profileData.name?.split(' ')[0] || '...';
        const currentHour = getHours(new Date());
        if (currentHour >= 5 && currentHour < 12) return `Good morning, ${name}!`;
        if (currentHour >= 12 && currentHour < 17) return `Good afternoon, ${name}.`;
        if (currentHour >= 17 && currentHour < 21) return `Good evening, ${name}.`;
        return `Hope you're having a productive evening, ${name}.`;
    }, [profileData.name]);

    const publicLink = useMemo((): string => {
        if (!username) return '';
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '');
        return `${baseUrl.replace(/\/$/, '')}/u/${username}`;
    }, [username]);

    const dashboardStats = useMemo(() => {
        const now = new Date();
        const todaysAcceptedBookings = bookings.filter(b => b.status === 'accepted' && isToday(parseDate(b.date))).sort((a, b) => a.time.localeCompare(b.time));
        const nextMeeting = todaysAcceptedBookings.find(booking => {
            const meetingDateTime = parseTime(booking.time, parseDate(booking.date));
            return isAfter(meetingDateTime, now);
        });
        const pendingRequestsCount = bookings.filter(b => b.status === 'pending').length;
        return { todaysAcceptedBookings, nextMeeting, pendingRequestsCount };
    }, [bookings]);

    const groupedAndSortedBookings = useMemo(() => {
        const bookingsToShow = activeTab === 'all' ? bookings : bookings.filter(b => b.status === activeTab);
        const groupedByDate = bookingsToShow.reduce((acc: Record<string, Booking[]>, booking) => {
            const dateKey = booking.date;
            if (!acc[dateKey]) { acc[dateKey] = []; }
            acc[dateKey].push(booking);
            return acc;
        }, {});
        const sortedDateKeys = Object.keys(groupedByDate).sort((a, b) => {
            if (activeTab === 'pending' || activeTab === 'accepted') { return a.localeCompare(b); }
            return b.localeCompare(a);
        });
        return sortedDateKeys.map(dateKey => {
            const date = parseDate(dateKey);
            let title = '';
            if (isToday(date)) { title = `Today · ${formatDate(date, 'MMMM d')}`; }
            else if (isTomorrow(date)) { title = `Tomorrow · ${formatDate(date, 'MMMM d')}`; }
            else { title = formatDate(date, 'EEEE, MMMM d'); }
            const bookingsInGroup = groupedByDate[dateKey];
            bookingsInGroup.sort((a, b) => a.time.localeCompare(b.time));
            return { title, bookings: bookingsInGroup };
        });
    }, [bookings, activeTab]);

    const handleImageChange = (event: ChangeEvent<HTMLInputElement>): void => {
        if (imagePreview && imagePreview.startsWith('blob:')) {
            URL.revokeObjectURL(imagePreview);
        }
        const file = event.target.files?.[0];
        if (!file) {
            setImageError(null);
            return;
        }
        if (!ALLOWED_FILE_TYPES.includes(file.type)) {
            setImageError(`Invalid file type. Please use JPG, PNG, GIF, or WebP.`);
            return;
        }
        if (file.size > MAX_FILE_SIZE) {
            setImageError(`File is too large. Max size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`);
            return;
        }
        setImageError(null);
        const newPreviewUrl = URL.createObjectURL(file);
        setImagePreview(newPreviewUrl);
        setImageFile(file);
    };

    const handleRemoveImage = (): void => {
        if (imagePreview && imagePreview.startsWith('blob:')) {
            URL.revokeObjectURL(imagePreview);
        }
        setImageFile(null);
        setImagePreview(null);
        setImageError(null);
        setProfileData(prev => ({ ...prev, photoUrl: '' }));
    };

    const validateProfileData = (data: ProfileData): ProfileFormErrors => {
        const errors: ProfileFormErrors = {};
        if (!data.name?.trim()) { errors.name = 'Name is required.'; }
        if (data.linkedin && !URL_REGEX.test(data.linkedin)) { errors.linkedin = 'Please enter a valid LinkedIn URL.'; }
        if (data.twitter && !URL_REGEX.test(data.twitter)) { errors.twitter = 'Please enter a valid Twitter/X URL.'; }
        if (data.website && !URL_REGEX.test(data.website)) { errors.website = 'Please enter a valid Website URL.'; }
        return errors;
    };

    const saveProfile = async (): Promise<void> => {
        if (!user?.email) {
            showToast("Authentication error. Please sign in again.", "error");
            return;
        }

        const validationErrors = validateProfileData(profileData);
        if (Object.keys(validationErrors).length > 0) {
            setProfileErrors(validationErrors);
            showToast("Please fix the errors in the profile form.", "error");
            return;
        }

        setProfileErrors({});
        setIsSavingProfile(true);

        try {
            const storage = getStorage();
            let newPhotoUrl = profileData.photoUrl;

            const deleteOldPhoto = async () => {
                if (initialPhotoUrl) {
                    try {
                        const oldImageRef = storageRef(storage, initialPhotoUrl);
                        await deleteObject(oldImageRef);
                    } catch (error) {
                        const deleteError = error as { code?: string };
                        if (deleteError.code !== 'storage/object-not-found') {
                            console.warn("Could not delete old photo, continuing.", deleteError);
                        }
                    }
                }
            };

            if (imageFile) {
                await deleteOldPhoto();
                const sanitizedFileName = imageFile.name.replace(/\s+/g, '_');
                const imagePath = `profile_images/${user.email}/${Date.now()}-${sanitizedFileName}`;
                const fileRef = storageRef(storage, imagePath);
                await uploadBytes(fileRef, imageFile);
                newPhotoUrl = await getDownloadURL(fileRef);
            } else if (initialPhotoUrl && !profileData.photoUrl) {
                await deleteOldPhoto();
                newPhotoUrl = '';
            }

            const dataToSave = { ...profileData, photoUrl: newPhotoUrl };
            const userDocRef = doc(db, 'users', user.email);
            await updateDoc(userDocRef, dataToSave);

            setProfileData(dataToSave);
            // FIX: Use '?? null' to prevent passing 'undefined' to the state setter.
            setInitialPhotoUrl(newPhotoUrl ?? null);
            setImageFile(null);

            showToast("Profile saved successfully!", "success");

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            console.error("ERROR in saveProfile:", error);
            showToast(`An error occurred while saving: ${errorMessage}`, "error");
        } finally {
            setIsSavingProfile(false);
        }
    };

    const handleUpdateStatus = async (bookingId: string, status: Booking['status']): Promise<void> => {
        if (!user?.email) return;
        setUpdatingBookingId(bookingId);
        const bookingRef = doc(db, 'users', user.email, 'bookings', bookingId);

        try {
            await updateDoc(bookingRef, { status, statusUpdatedAt: Timestamp.now() });

            const updatedBooking = bookings.find(b => b.id === bookingId);
            if (!updatedBooking) return;

            if (status === 'accepted') {
                const apiPayload = {
                    ownerEmail: user.email,
                    ownerName: profileData.name || username,
                    requesterEmail: updatedBooking.requesterEmail,
                    requesterName: updatedBooking.requesterName,
                    date: updatedBooking.date,
                    time: updatedBooking.time,
                    subject: updatedBooking.subject,
                    duration: updatedBooking.duration,
                };
                fetch('/api/send-confirmation', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(apiPayload),
                }).catch(apiError => console.error('Error sending confirmation email:', apiError));
                showToast(`Meeting with ${updatedBooking.requesterName} accepted!`, "success");
            } else if (status === 'declined') {
                const apiPayload = {
                    ownerName: profileData.name || username,
                    requesterEmail: updatedBooking.requesterEmail,
                    requesterName: updatedBooking.requesterName,
                    date: updatedBooking.date,
                    time: updatedBooking.time,
                    subject: updatedBooking.subject,
                    rebookUrl: publicLink,
                };
                fetch('/api/send-decline', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(apiPayload),
                }).catch(apiError => console.error('Error sending decline email:', apiError));
                showToast(`Meeting with ${updatedBooking.requesterName} declined.`, "info");
            }
        } catch (error) {
            console.error('Error updating booking status:', error);
            showToast("Failed to update booking. Please try again.", "error");
        } finally {
            setUpdatingBookingId(null);
        }
    };

    const handleBatchUpdate = async (status: 'accepted' | 'declined'): Promise<void> => {
        if (!user?.email || selectedBookings.length === 0) return;
        setIsBatchUpdating(true);
        const batch = writeBatch(db);
        selectedBookings.forEach(id => {
            const ref = doc(db, 'users', user.email!, 'bookings', id);
            batch.update(ref, { status, statusUpdatedAt: Timestamp.now() });
        });
        try {
            await batch.commit();
            setSelectedBookings([]);
            showToast(`${selectedBookings.length} bookings ${status} successfully!`, "success");
        }
        catch (error) {
            console.error("Batch update failed:", error);
            showToast(`Failed to ${status} bookings. Please try again.`, "error");
        }
        finally { setIsBatchUpdating(false); }
    };

    const openCancelModal = (booking: Booking): void => {
        setBookingToCancel(booking);
        const formattedDate = formatDate(parseDate(booking.date), 'MMMM d');
        const formattedTime = formatDate(parseTime(booking.time), 'h:mm a');
        const suggestedNote = `Hi ${booking.requesterName},\n\nUnfortunately, I need to cancel our meeting scheduled for ${formattedDate} at ${formattedTime}. Apologies for any inconvenience this may cause.\n\nPlease feel free to book another time through my link.\n\nBest,\n${profileData.name.split(' ')[0]}`;
        setCancellationNote(suggestedNote);
        setIsCancelModalOpen(true);
    };
    const closeCancelModal = (): void => { setIsCancelModalOpen(false); setBookingToCancel(null); setCancellationNote(''); };

    const handleConfirmCancel = async (): Promise<void> => {
        if (!user?.email || !bookingToCancel || !publicLink) return;
        setIsCancelling(true);
        const bookingRef = doc(db, 'users', user.email, 'bookings', bookingToCancel.id);
        try {
            await updateDoc(bookingRef, { status: 'canceled', cancellationNote: cancellationNote || '', statusUpdatedAt: Timestamp.now() });

            const apiPayload = {
                ownerName: profileData.name || username,
                requesterEmail: bookingToCancel.requesterEmail,
                requesterName: bookingToCancel.requesterName,
                date: bookingToCancel.date,
                time: bookingToCancel.time,
                subject: bookingToCancel.subject,
                cancellationNote: cancellationNote,
                rebookUrl: publicLink
            };
            await fetch('/api/send-cancellation', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(apiPayload),
            });
            closeCancelModal();
            showToast("Meeting cancelled successfully.", "info");
        } catch (error) {
            console.error('Error canceling booking:', error);
            showToast('Failed to cancel the booking. Please check your connection and try again.', "error");
        } finally {
            setIsCancelling(false);
        }
    };

    const openRescheduleModal = (booking: Booking): void => {
        setRescheduleError(null);
        setRescheduleSuccessMessage('');
        const slots = generateAvailableSlots(booking.date, booking.id);
        setAvailableSlots(slots);
        setBookingToReschedule(booking);
        setNewBookingTime(slots.length > 0 ? slots[0] : '');
        setIsRescheduleModalOpen(true);
    };

    const closeRescheduleModal = (): void => {
        setIsRescheduleModalOpen(false); setBookingToReschedule(null); setAvailableSlots([]);
        setNewBookingTime(''); setRescheduleError(null);
    };

    const handleConfirmReschedule = async (): Promise<void> => {
        if (!user?.email || !bookingToReschedule || !newBookingTime) {
            setRescheduleError("Missing required information. Please try again.");
            return;
        }
        setIsRescheduling(true);
        setRescheduleError(null);

        const bookingRef = doc(db, "users", user.email, "bookings", bookingToReschedule.id);

        try {
            await runTransaction(db, async (transaction) => {
                const bookingDoc = await transaction.get(bookingRef);
                if (!bookingDoc.exists()) {
                    throw "Booking no longer exists.";
                }
                transaction.update(bookingRef, {
                    time: newBookingTime,
                    status: 'accepted',
                    rescheduledAt: Timestamp.now(),
                    statusUpdatedAt: Timestamp.now(),
                });
            });

            const apiPayload = {
                ownerEmail: user.email,
                bookingId: bookingToReschedule.id,
                newTime: newBookingTime,
                newDate: bookingToReschedule.date,
            };
            await fetch('/api/reschedule-booking', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(apiPayload),
            });

            showToast(`Booking rescheduled to ${formatDate(parseTime(newBookingTime), 'h:mm a')}! Confirmation emails sent.`, "success");
            closeRescheduleModal();

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            console.error("Reschedule failed:", error);
            setRescheduleError(errorMessage);
        } finally {
            setIsRescheduling(false);
        }
    };

    const generateAvailableSlots = useCallback((bookingDate: string, bookingIdToExclude?: string): string[] => {
        const dayKey = formatDate(parseDate(bookingDate), 'yyyy-MM-dd');
        const dayData = normalizeDayData(availability[dayKey]);

        const todaysBookedSlots = new Set<string>(
            bookings
                .filter(b => b.status === 'accepted' && b.date === bookingDate && b.id !== bookingIdToExclude)
                .map(b => b.time)
        );

        const slots: string[] = [];
        const now = new Date();

        dayData.ranges.forEach(range => {
            if (!range.start || !range.end) return;
            let currentTime = parseTime(range.start, parseDate(dayKey));
            const endTime = parseTime(range.end, parseDate(dayKey));
            const interval = range.interval || 30;

            while (isBefore(currentTime, endTime)) {
                const timeStr = formatDate(currentTime, 'HH:mm');
                const slotDateTime = parseTime(timeStr, parseDate(dayKey));
                if (!todaysBookedSlots.has(timeStr) && isAfter(slotDateTime, now)) {
                    slots.push(timeStr);
                }
                currentTime = addMinutes(currentTime, interval);
            }
        });
        return slots;
    }, [availability, bookings, normalizeDayData]);

    const acceptedBookingSlots = useMemo(() => {
        const set = new Set<string>();
        bookings.filter(b => b.status === 'accepted').forEach(b => set.add(`${b.date}_${b.time}`));
        return set;
    }, [bookings]);

    const isRangeBooked = useCallback((dayKey: string, slot: TimeRange): boolean => {
        if (!slot.start || !slot.end) return false;
        let start = parseTime(slot.start, parseDate(dayKey));
        const end = parseTime(slot.end, parseDate(dayKey));

        while (isBefore(start, end)) {
            if (acceptedBookingSlots.has(`${dayKey}_${formatDate(start, 'HH:mm')}`)) return true;
            start = addMinutes(start, slot.interval);
        }
        return false;
    }, [acceptedBookingSlots]);

    const addRange = (dayKey: string): void => {
        setAvailability(prev => {
            const currentDayData = normalizeDayData(prev[dayKey]);
            const updatedRanges = [...currentDayData.ranges, { ...DEFAULT_RANGE }];
            return { ...prev, [dayKey]: { ...currentDayData, ranges: updatedRanges } };
        });
    };

    const removeRange = (dayKey: string, index: number): void => {
        setAvailability(prev => {
            const currentDayData = normalizeDayData(prev[dayKey]);
            const updatedRanges = currentDayData.ranges.filter((_, i) => i !== index);
            if (updatedRanges.length === 0 && currentDayData.blocks.length === 0) {
                const { [dayKey]: _, ...rest } = prev;
                return rest;
            }
            return { ...prev, [dayKey]: { ...currentDayData, ranges: updatedRanges } };
        });
    };

    const handleRangeChange = (dayKey: string, index: number, field: keyof TimeRange, value: string | number): void => {
        setAvailability(prev => {
            const currentDayData = normalizeDayData(prev[dayKey]);
            const updatedRanges = currentDayData.ranges.map((item, i) =>
                i === index ? { ...item, [field]: value } : item
            );
            return { ...prev, [dayKey]: { ...currentDayData, ranges: updatedRanges } };
        });
    };

    const addBlock = (dayKey: string): void => {
        const newBlock: TimeBlock = { id: uuidv4(), title: 'Lunch', startTime: '12:00', endTime: '13:00' };
        setAvailability(prev => {
            const currentDayData = normalizeDayData(prev[dayKey]);
            const updatedBlocks = [...currentDayData.blocks, newBlock];
            return { ...prev, [dayKey]: { ...currentDayData, blocks: updatedBlocks } };
        });
    };

    const removeBlock = (dayKey: string, index: number): void => {
        setAvailability(prev => {
            const currentDayData = normalizeDayData(prev[dayKey]);
            const updatedBlocks = currentDayData.blocks.filter((_, i) => i !== index);
            if (currentDayData.ranges.length === 0 && updatedBlocks.length === 0) {
                const { [dayKey]: _, ...rest } = prev;
                return rest;
            }
            return { ...prev, [dayKey]: { ...currentDayData, blocks: updatedBlocks } };
        });
    };

    const handleBlockChange = (dayKey: string, index: number, field: keyof Omit<TimeBlock, 'id'>, value: string): void => {
        setAvailability(prev => {
            const currentDayData = normalizeDayData(prev[dayKey]);
            const updatedBlocks = currentDayData.blocks.map((block, i) =>
                i === index ? { ...block, [field]: value } : block
            );
            return { ...prev, [dayKey]: { ...currentDayData, blocks: updatedBlocks } };
        });
    };

    const saveAvailability = async (): Promise<void> => {
        if (!user?.email) return;

        const sanitizedAvailability = Object.keys(availability).reduce((acc: Availability, dayKey) => {
            const dayData = normalizeDayData(availability[dayKey]);
            const validRanges = dayData.ranges.filter(slot => slot.start && slot.end && typeof slot.interval === 'number');
            const validBlocks = dayData.blocks.filter(block => block.title && block.startTime && block.endTime);
            if (validRanges.length > 0 || validBlocks.length > 0) {
                acc[dayKey] = { ranges: validRanges, blocks: validBlocks };
            }
            return acc;
        }, {});

        try {
            await setDoc(doc(db, 'users', user.email), {
                availability: sanitizedAvailability
            }, { merge: true });
            showToast('Availability saved successfully!', "success");
        } catch (error) {
            console.error("Error saving availability:", error);
            showToast("Failed to save availability. Please try again.", "error");
        }
    };

    const handleCopy = (): void => {
        if (!publicLink) return;
        navigator.clipboard.writeText(publicLink);
        setCopied(true);
        showToast("Public link copied to clipboard!", "success");
        setTimeout(() => setCopied(false), 2000);
    };

    const scrollToSection = (sectionId: string): void => {
        const element = document.getElementById(sectionId);
        element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const handleReviewPending = (): void => {
        setActiveTab('pending');
        setTimeout(() => { scrollToSection('booking-requests'); }, 100);
    };

    const handleToggleSelectBooking = (id: string): void => {
        setSelectedBookings(prev => prev.includes(id) ? prev.filter(bId => bId !== id) : [...prev, id]);
    };

    const handlePrintCalendar = (): void => {
        setIsPrinting(true);
    };

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center gap-6 animate-fade-in-up">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
                    <p className="text-slate-500 font-semibold text-lg">Loading Dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <Fragment>
            <style jsx global>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Lexend:wght@400;500;600;700;800&display=swap');
                
                body {
                    font-family: 'Inter', sans-serif;
                    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
                    min-height: 100vh;
                }

                .shadow-subtle {
                    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05);
                }

                @keyframes fade-in-up {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                @keyframes expand-bar {
                    from {
                        width: 0%;
                    }
                    to {
                        width: var(--target-width, 100%);
                    }
                }

                @keyframes breathe {
                    0%, 100% {
                        transform: scale(1);
                    }
                    50% {
                        transform: scale(1.02);
                    }
                }

                @keyframes pulse-soft {
                    0%, 100% {
                        opacity: 1;
                    }
                    50% {
                        opacity: 0.8;
                    }
                }

                .animate-fade-in-up {
                    animation: fade-in-up 0.6s ease-out;
                }

                .animate-expand-bar {
                    animation: expand-bar 1s ease-out forwards;
                }

                .animate-breathe {
                    animation: breathe 4s ease-in-out infinite;
                }

                .animate-pulse-soft {
                    animation: pulse-soft 2s ease-in-out infinite;
                }
                
                @media print {
                    body {
                        background-color: white !important;
                    }
                    .screen-only {
                        display: none !important;
                    }
                    .printable-area {
                        display: block !important;
                    }
                }
            `}</style>

            <div className="screen-only">
                <CancellationModal isOpen={isCancelModalOpen} onClose={closeCancelModal} onConfirm={handleConfirmCancel} booking={bookingToCancel} note={cancellationNote} setNote={setCancellationNote} isCancelling={isCancelling} />
                <RescheduleModal isOpen={isRescheduleModalOpen} onClose={closeRescheduleModal} onConfirm={handleConfirmReschedule} booking={bookingToReschedule} availableSlots={availableSlots} newBookingTime={newBookingTime} setNewBookingTime={setNewBookingTime} isRescheduling={isRescheduling} error={rescheduleError} />
                <AvailabilityModal
                    isOpen={isAvailModalOpen}
                    onClose={() => setIsAvailModalOpen(false)}
                    dayToEdit={dayToEdit}
                    availability={availability}
                    isRangeBooked={isRangeBooked}
                    handleRangeChange={handleRangeChange}
                    addRange={addRange}
                    removeRange={removeRange}
                    handleBlockChange={handleBlockChange}
                    addBlock={addBlock}
                    removeBlock={removeBlock}
                />
                
                <div className="bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
                    {/* ✨ ENHANCED: Premium header with glassmorphism */}
                    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-gray-200/60 shadow-lg shadow-slate-900/5">
                        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center h-20">
                            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3" style={{ fontFamily: "'Lexend', sans-serif" }}>
                                <BookUser className="text-blue-600" size={32} /> 
                                Meeteazy
                            </h1>
                            
                            {/* Desktop Navigation */}
                            <nav className="hidden md:flex items-center gap-2">
                                <button
                                    onClick={() => scrollToSection('analytics-dashboard')}
                                    className="px-4 h-12 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
                                >
                                    Analytics
                                </button>
                                <button
                                    onClick={() => scrollToSection('profile-section')}
                                    className="px-4 h-12 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
                                >
                                    Profile
                                </button>
                                <button
                                    onClick={() => signOut(auth)}
                                    className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-red-600 px-4 h-12 rounded-xl hover:bg-red-50 transition-colors"
                                >
                                    <LogOut size={16} /> Sign Out
                                </button>
                            </nav>

                            {/* Mobile Navigation */}
                            <div className="md:hidden">
                                <Menu as="div" className="relative">
                                    <Menu.Button className="flex items-center justify-center h-12 w-12 rounded-full text-slate-600 hover:bg-slate-100">
                                        <span className="sr-only">Open menu</span>
                                        <MenuIcon size={24} />
                                    </Menu.Button>
                                    <Transition as={Fragment} enter="transition ease-out duration-100" enterFrom="transform opacity-0 scale-95" enterTo="transform opacity-100 scale-100" leave="transition ease-in duration-75" leaveFrom="transform opacity-100 scale-100" leaveTo="transform opacity-0 scale-95">
                                        <Menu.Items className="absolute right-0 mt-2 w-48 origin-top-right bg-white rounded-2xl shadow-xl ring-1 ring-black ring-opacity-5 focus:outline-none p-2">
                                            <Menu.Item>
                                                {({ active }) => (
                                                    <button
                                                        onClick={() => scrollToSection('analytics-dashboard')}
                                                        className={clsx('w-full text-left px-4 py-3 rounded-xl text-sm flex items-center gap-3', active && 'bg-slate-100')}
                                                    >
                                                        <BarChart2 size={16} /> Analytics
                                                    </button>
                                                )}
                                            </Menu.Item>
                                            <Menu.Item>
                                                {({ active }) => (
                                                    <button
                                                        onClick={() => scrollToSection('profile-section')}
                                                        className={clsx('w-full text-left px-4 py-3 rounded-xl text-sm flex items-center gap-3', active && 'bg-slate-100')}
                                                    >
                                                        <Settings size={16} /> Profile
                                                    </button>
                                                )}
                                            </Menu.Item>
                                            <div className="my-1 h-px bg-slate-200" />
                                            <Menu.Item>
                                                {({ active }) => (
                                                    <button
                                                        onClick={() => signOut(auth)}
                                                        className={clsx('w-full text-left px-4 py-3 rounded-xl text-sm flex items-center gap-3 text-red-600', active && 'bg-red-50')}
                                                    >
                                                        <LogOut size={16} /> Sign Out
                                                    </button>
                                                )}
                                            </Menu.Item>
                                        </Menu.Items>
                                    </Transition>
                                </Menu>
                            </div>
                        </div>
                    </header>

                    <main className="max-w-screen-2xl mx-auto p-4 sm:p-6 lg:p-8">
                        <div className="mb-12 animate-fade-in-up">
                            <h2 className="text-4xl sm:text-5xl font-extrabold text-slate-900" style={{ fontFamily: "'Lexend', sans-serif" }}>
                                {smartGreeting}
                            </h2>
                            <p className="text-slate-600 mt-3 text-xl">Here's your summary at a glance.</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                            <StatCard index={0} title="Today's Meetings" value={dashboardStats.todaysAcceptedBookings.length} icon={<CalendarIconLucide />} />
                            <StatCard index={1} title="Next Meeting" value={dashboardStats.nextMeeting ? `${formatDate(parseTime(dashboardStats.nextMeeting.time), 'h:mm a')}` : "None"} note={dashboardStats.nextMeeting ? `with ${dashboardStats.nextMeeting.requesterName}` : "Enjoy your day!"} icon={<Clock />} />
                            <StatCard index={2} title="Pending Requests" value={dashboardStats.pendingRequestsCount} icon={<UserIcon />} note={dashboardStats.pendingRequestsCount > 0 ? "Action required" : "All caught up"} />
                            <div onClick={handleCopy} className="cursor-pointer group">
                                <StatCard index={3} title="Public Link" value={copied ? "Copied!" : "Copy Link"} note={username ? `/u/${username}` : 'loading...'} icon={copied ? <ClipboardCheck className="text-green-500" /> : <LinkIcon className="transition-transform group-hover:rotate-12" />} />
                            </div>
                        </div>

                        <div className="mb-12">
                            <SmartAssistant profileData={profileData} availability={availability} bookings={bookings} onScrollTo={scrollToSection} onReviewPending={handleReviewPending} onCancelBooking={openCancelModal} onReschedule={openRescheduleModal} />
                        </div>

                        <div className="space-y-10">
                            <CollapsibleSection id="analytics-dashboard" title="Analytics Dashboard" icon={<BarChart2 size={24} />} summary="View insights and booking patterns">
                                <AnalyticsDashboard bookings={bookings} />
                            </CollapsibleSection>

                            <CollapsibleSection id="booking-requests" title="Booking Requests" icon={<BookUser size={24} />} summary={`${bookings.filter(b => activeTab === 'all' ? true : b.status === activeTab).length} total ${activeTab !== 'all' ? activeTab : ''} requests`} defaultOpen={true}>
                                <div className="border-t border-slate-200/80">
                                    <div className="p-6 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                                        <div className="p-2 bg-slate-100 rounded-2xl">
                                            <nav className="flex items-center gap-1 overflow-x-auto">
                                                {(['pending', 'accepted', 'declined', 'canceled', 'all'] as const).map(tab => {
                                                    const count = tab === 'all' ? bookings.length : (bookings.filter(b => b.status === tab).length);
                                                    return (
                                                        <button
                                                            key={tab}
                                                            onClick={() => { setActiveTab(tab); setSelectedBookings([]); }}
                                                            className={clsx('px-4 py-2.5 text-sm font-semibold rounded-xl flex items-center gap-2.5 capitalize transition-colors whitespace-nowrap', activeTab === tab ? 'bg-white text-slate-800 shadow-md' : 'text-slate-600 hover:bg-white/60')}
                                                        >
                                                            {tab} <span className={clsx('px-2 py-0.5 rounded-full text-xs font-bold', activeTab === tab ? 'bg-blue-600 text-white' : 'bg-gray-300 text-slate-700')}>{count}</span>
                                                        </button>
                                                    );
                                                })}
                                            </nav>
                                        </div>
                                    </div>

                                    {selectedBookings.length > 0 && (
                                        <div className="px-6 pb-4 border-b border-gray-200/80">
                                            <div className="bg-slate-100 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                                                <p className="text-sm font-semibold text-slate-700">{selectedBookings.length} request{selectedBookings.length > 1 && 's'} selected</p>
                                                <div className="flex items-center gap-3">
                                                    <button
                                                        onClick={() => handleBatchUpdate('accepted')}
                                                        disabled={isBatchUpdating}
                                                        className="flex items-center gap-2 bg-green-600 text-white px-4 h-10 rounded-xl text-sm font-semibold hover:bg-green-700 disabled:bg-green-400"
                                                    >
                                                        <Check size={16} /> Accept
                                                    </button>
                                                    <button
                                                        onClick={() => handleBatchUpdate('declined')}
                                                        disabled={isBatchUpdating}
                                                        className="flex items-center gap-2 bg-red-600 text-white px-4 h-10 rounded-xl text-sm font-semibold hover:bg-red-700 disabled:bg-red-400"
                                                    >
                                                        <X size={16} /> Decline
                                                    </button>
                                                    <button
                                                        onClick={() => setSelectedBookings([])}
                                                        className="text-slate-500 hover:text-slate-800 p-2"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {groupedAndSortedBookings.length > 0 ? (
                                        <div className="pb-6 space-y-10 pt-4">
                                            {groupedAndSortedBookings.map(group => (
                                                <section key={group.title} aria-labelledby={`header-${group.title}`}>
                                                    <h3 id={`header-${group.title}`} className="text-lg font-bold text-slate-900 px-6 pb-4">{group.title}</h3>
                                                    <div className="space-y-4 px-6">
                                                        {group.bookings.map(b => (
                                                            <BookingCard key={b.id} booking={b} onUpdateStatus={handleUpdateStatus} onCancel={openCancelModal} onReschedule={openRescheduleModal} isSelected={selectedBookings.includes(b.id)} onToggleSelect={handleToggleSelectBooking} isUpdating={updatingBookingId === b.id} onDownloadIcs={handleDownloadIcs} isDownloading={isDownloading === b.id} />
                                                        ))}
                                                    </div>
                                                </section>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-24 px-6">
                                            <div className="text-slate-400 mb-6">
                                                <BookUser size={64} className="mx-auto" />
                                            </div>
                                            <p className="text-slate-500 font-medium text-xl">No {activeTab} requests found</p>
                                            <p className="text-slate-400 text-sm mt-2">This category is all clear. ✨</p>
                                        </div>
                                    )}
                                </div>
                            </CollapsibleSection>

                            <CollapsibleSection id="profile-section" title="Profile & Branding" icon={<Settings size={24} />} summary="Manage your public information and branding">
                                <div className="border-t border-slate-200/80 p-6 space-y-8">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div>
                                            <label className="block">
                                                <span className="text-sm font-medium text-slate-800">Name</span>
                                                <input
                                                    type="text"
                                                    value={profileData.name}
                                                    onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                                                    className="mt-2 block w-full h-12 border-gray-300 bg-white text-slate-900 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                                />
                                            </label>
                                            {profileErrors.name && <p className="text-red-600 text-xs mt-1">{profileErrors.name}</p>}
                                        </div>
                                        <label className="block">
                                            <span className="text-sm font-medium text-slate-800">Role</span>
                                            <input
                                                type="text"
                                                value={profileData.role}
                                                onChange={(e) => setProfileData({ ...profileData, role: e.target.value })}
                                                className="mt-2 block w-full h-12 border-gray-300 bg-white text-slate-900 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                                placeholder="e.g., Founder, Software Engineer"
                                            />
                                        </label>
                                    </div>

                                    <label className="block">
                                        <span className="text-sm font-medium text-slate-800">Company</span>
                                        <input
                                            type="text"
                                            value={profileData.company}
                                            onChange={(e) => setProfileData({ ...profileData, company: e.target.value })}
                                            className="mt-2 block w-full h-12 border-gray-300 bg-white text-slate-900 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                            placeholder="Your company name"
                                        />
                                    </label>

                                    <div>
                                        <span className="block text-sm font-medium text-slate-800 mb-3">Profile Photo</span>
                                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                                            {imagePreview ? (
                                                <img src={imagePreview} alt="Profile preview" className="h-32 w-32 rounded-full object-cover border-4 border-white shadow-xl bg-gray-100" />
                                            ) : (
                                                <div className="h-32 w-32 flex items-center justify-center rounded-full bg-gray-100 text-slate-400 border-4 border-white shadow-xl shrink-0">
                                                    <UserIcon size={64} />
                                                </div>
                                            )}
                                            <div className="flex-1">
                                                <div className="flex items-center gap-x-4">
                                                    <input type="file" id="photo-upload" name="photo-upload" className="sr-only" accept={ALLOWED_FILE_TYPES.join(',')} onChange={handleImageChange} />
                                                    <label htmlFor="photo-upload" className="cursor-pointer rounded-xl bg-white px-6 h-12 flex items-center text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-all">
                                                        Change
                                                    </label>
                                                    <button type="button" onClick={handleRemoveImage} className="text-sm font-semibold text-red-600 hover:text-red-800">
                                                        Remove
                                                    </button>
                                                </div>
                                                <div className="mt-3 text-xs text-slate-500 space-y-1">
                                                    {imageFile && !imageError && (
                                                        <div className="flex items-center gap-2 text-green-700">
                                                            <FileCheck2 size={14} />
                                                            <span>{imageFile.name} ({(imageFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                                                        </div>
                                                    )}
                                                    {imageError && (
                                                        <div className="flex items-center gap-2 text-red-600">
                                                            <AlertCircle size={14} />
                                                            <span>{imageError}</span>
                                                        </div>
                                                    )}
                                                    {!imageFile && !imageError && (
                                                        <p>Max file size: 5MB. Allowed types: JPG, PNG, GIF, WebP.</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-6 border-t border-gray-200/80 space-y-6">
                                        <label className="block">
                                            <span className="text-sm font-medium text-slate-800">Bio</span>
                                            <p className="text-xs text-slate-600 mb-2">A short professional summary.</p>
                                            <textarea
                                                rows={4}
                                                value={profileData.bio || ''}
                                                onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
                                                className="mt-1 block w-full border-gray-300 bg-white text-slate-900 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                                placeholder="Tell us about your experience..."
                                            />
                                        </label>
                                    </div>

                                    <div className="pt-6 border-t border-gray-200/80 space-y-4">
                                        <div>
                                            <h3 className="text-base font-semibold text-slate-800">Social & Professional Links</h3>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div>
                                                <label className="block">
                                                    <span className="text-sm font-medium text-slate-800">LinkedIn</span>
                                                    <input
                                                        type="url"
                                                        value={profileData.linkedin || ''}
                                                        onChange={(e) => setProfileData({ ...profileData, linkedin: e.target.value })}
                                                        className="mt-2 block w-full h-12 border-gray-300 bg-white text-slate-900 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                                        placeholder="https://linkedin.com/in/..."
                                                    />
                                                </label>
                                                {profileErrors.linkedin && <p className="text-red-600 text-xs mt-1">{profileErrors.linkedin}</p>}
                                            </div>
                                            <div>
                                                <label className="block">
                                                    <span className="text-sm font-medium text-slate-800">Twitter / X</span>
                                                    <input
                                                        type="url"
                                                        value={profileData.twitter || ''}
                                                        onChange={(e) => setProfileData({ ...profileData, twitter: e.target.value })}
                                                        className="mt-2 block w-full h-12 border-gray-300 bg-white text-slate-900 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                                        placeholder="https://x.com/..."
                                                    />
                                                </label>
                                                {profileErrors.twitter && <p className="text-red-600 text-xs mt-1">{profileErrors.twitter}</p>}
                                            </div>
                                            <label className="block">
                                                <span className="text-sm font-medium text-slate-800">WhatsApp</span>
                                                <input
                                                    type="tel"
                                                    value={profileData.whatsapp || ''}
                                                    onChange={(e) => setProfileData({ ...profileData, whatsapp: e.target.value })}
                                                    className="mt-2 block w-full h-12 border-gray-300 bg-white text-slate-900 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                                    placeholder="e.g. +1234567890"
                                                />
                                            </label>
                                            <div>
                                                <label className="block">
                                                    <span className="text-sm font-medium text-slate-800">Website</span>
                                                    <input
                                                        type="url"
                                                        value={profileData.website || ''}
                                                        onChange={(e) => setProfileData({ ...profileData, website: e.target.value })}
                                                        className="mt-2 block w-full h-12 border-gray-300 bg-white text-slate-900 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                                        placeholder="https://yourwebsite.com"
                                                    />
                                                </label>
                                                {profileErrors.website && <p className="text-red-600 text-xs mt-1">{profileErrors.website}</p>}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-8 flex items-center justify-end gap-4">
                                        <button
                                            onClick={saveProfile}
                                            disabled={isSavingProfile}
                                            className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-8 h-14 rounded-2xl font-semibold shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 disabled:from-blue-400 disabled:to-blue-500 disabled:cursor-not-allowed disabled:shadow-lg disabled:transform-none"
                                        >
                                            {isSavingProfile ? 'Saving...' : 'Save Profile'}
                                        </button>
                                    </div>
                                </div>
                            </CollapsibleSection>

                            <CollapsibleSection id="availability-section" title="Availability" icon={<CalendarIconLucide size={24} />} summary="Set your weekly schedule and meeting preferences">
                                <div className="border-t border-slate-200/80 p-6">
                                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 mb-8">
                                        <div className="flex items-start gap-4 p-5 bg-blue-50 border-l-4 border-blue-400 rounded-r-2xl flex-1">
                                            <Info className="w-6 h-6 text-blue-700 mt-0.5 shrink-0" />
                                            <p className="text-sm text-blue-800">Set your weekly schedule. Click any day on the calendar to add or edit your available time ranges and block off specific times like lunch.</p>
                                        </div>
                                        <div className="flex flex-col sm:flex-row gap-4 shrink-0">
                                            <button
                                                onClick={handlePrintCalendar}
                                                className="self-end flex-shrink-0 flex items-center justify-center gap-2 bg-white text-blue-700 border border-gray-300 hover:border-blue-400 hover:bg-blue-50 px-6 h-12 text-sm font-semibold rounded-xl transition-colors shadow-sm"
                                            >
                                                <Printer size={16} /> Print
                                            </button>
                                        </div>
                                    </div>
                                    <AvailabilityCalendar availability={availability} openModal={(day) => { setDayToEdit(day); setIsAvailModalOpen(true); }} normalizeDayData={normalizeDayData} />
                                    <div className="mt-8 border-t border-gray-200/80 pt-6 flex justify-end">
                                        <button
                                            onClick={saveAvailability}
                                            className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-8 h-14 rounded-2xl font-semibold shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1"
                                        >
                                            Save All Availability
                                        </button>
                                    </div>
                                </div>
                            </CollapsibleSection>
                        </div>
                    </main>
                </div>
            </div>

            {isPrinting && (
                <div className="printable-area hidden">
                    <AvailabilityCalendar
                        availability={availability}
                        openModal={() => { }}
                        normalizeDayData={normalizeDayData}
                    />
                </div>
            )}
        </Fragment>
    )
}

// ✨ ENHANCED: AvailabilityCalendar with improved mobile touch interactions
const AvailabilityCalendar = ({ availability, openModal, normalizeDayData }: AvailabilityCalendarProps) => {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const firstDay = startOfMonth(currentMonth);

    const startCalDate = subDays(firstDay, getDay(firstDay));
    const endCalDate = addDays(startCalDate, 41);

    const days = eachDayOfInterval({ start: startCalDate, end: endCalDate });

    return (
        <div className="bg-white/80 backdrop-blur-xl border border-white/50 rounded-3xl p-6 shadow-xl shadow-slate-900/5">
            <div className="flex items-center justify-between mb-6 screen-only">
                <h4 className="text-xl font-bold text-slate-900" style={{ fontFamily: "'Lexend', sans-serif" }}>
                    {formatDate(currentMonth, 'MMMM yyyy')}
                </h4>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                        className="flex items-center justify-center h-12 w-12 rounded-full hover:bg-slate-100 text-slate-500 transition-colors"
                        aria-label="Previous month"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <button
                        onClick={() => setCurrentMonth(new Date())}
                        className="px-4 h-12 text-sm font-semibold text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
                        aria-label="Today"
                    >
                        Today
                    </button>
                    <button
                        onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                        className="flex items-center justify-center h-12 w-12 rounded-full hover:bg-slate-100 text-slate-500 transition-colors"
                        aria-label="Next month"
                    >
                        <ChevronRight size={20} />
                    </button>
                </div>
            </div>
            <h4 className="text-lg font-bold text-slate-900 mb-4 hidden print:block">{formatDate(currentMonth, 'MMMM yyyy')}</h4>
            <div className="overflow-x-auto">
                <div className="min-w-[640px]">
                    <div className="grid grid-cols-7 text-center text-sm font-semibold text-slate-500 border-b border-gray-200 pb-3 mb-3">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                            <div key={day} className="py-2">{day}</div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 gap-px bg-slate-200 rounded-2xl overflow-hidden">
                        {days.map((day, dayIdx) => {
                            const dayKey = formatDate(day, 'yyyy-MM-dd');
                            const dayData = normalizeDayData(availability[dayKey]);
                            const isPastDay = isPast(day) && !isToday(day);
                            const isCurrentMonth = isSameMonth(day, currentMonth);

                            return (
                                <div
                                    key={dayKey}
                                    className={clsx(
                                        "h-32 sm:h-40 p-3 flex flex-col relative transition-colors duration-200 group bg-white",
                                        !isCurrentMonth ? "bg-slate-50/70" : (isPastDay ? 'bg-slate-50/50' : 'cursor-pointer hover:bg-blue-50/50')
                                    )}
                                    onClick={() => !isPastDay && openModal(day)}
                                >
                                    <time dateTime={dayKey} className={clsx(
                                        "text-sm font-semibold self-start flex items-center justify-center h-8 w-8 rounded-full transition-colors",
                                        isToday(day) && "bg-blue-600 text-white shadow-lg",
                                        !isCurrentMonth ? "text-slate-400" : (isPastDay ? "text-slate-400" : "text-slate-700")
                                    )}>
                                        {formatDate(day, 'd')}
                                    </time>
                                    <div className="mt-2 flex-grow overflow-y-auto">
                                        <ul className="space-y-1">
                                            {dayData.ranges.map((slot, i) => {
                                                if (!slot.start || !slot.end) return null;
                                                const start = formatDate(parseTime(slot.start), 'h:mma').replace(':00', '').toLowerCase();
                                                const end = formatDate(parseTime(slot.end), 'h:mma').replace(':00', '').toLowerCase();
                                                return (
                                                    <li key={i} className="text-[10px] leading-tight font-bold bg-blue-100 text-blue-800 rounded-lg p-1.5 truncate text-center">
                                                        {start}-{end}
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>
                                    {!isPastDay && (
                                        <div className="absolute bottom-2 left-2 right-2 text-center text-xs font-semibold text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity duration-200 screen-only">
                                            {dayData.ranges.length > 0 ? 'Edit' : '+ Add'}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};