"use client"

import Link from "next/link";
import { ReactNode } from "react";
import {
  BookUser,
  BrainCircuit,
  CalendarDays,
  Link as LinkIcon,
  Users,
  ArrowRight,
  Sparkles,
  CalendarSync,
  CalendarRange,
  Globe,
  UserCog,
  MailCheck,
  ListChecks,
} from "lucide-react";

// --- Main Landing Page Component ---
export default function LandingPage() {
  return (
    <div className="bg-white text-slate-800 antialiased">
      <Header />
      <main>
        <HeroSection />
        <FeaturesSection />
        <RealCapabilitiesSection />
        <HowItWorksSection />
      </main>
      <Footer />
    </div>
  );
}

// --- Page Sections & Components ---

const Header = () => (
  <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-lg border-b border-slate-200/70">
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
      <Link href="/" className="flex items-center gap-2.5">
        <BookUser className="w-7 h-7 text-blue-600" />
        <span className="text-xl font-bold text-slate-900 tracking-tight">Meeteazy</span>
      </Link>
      <nav className="flex items-center gap-2">
        <Link href="/signin" className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-blue-600 transition-colors">
          Sign In
        </Link>
        <Link href="/signup" className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm hover:shadow-md hover:-translate-y-px">
          Get Started
        </Link>
      </nav>
    </div>
  </header>
);

const HeroSection = () => (
  <section className="relative pt-20 pb-24 md:pt-32 md:pb-36 text-center">
    <div className="absolute inset-0 bottom-1/4 bg-slate-50 -z-10"></div>
    <div className="container mx-auto px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 leading-tight">
          Smart Personal Scheduling
        </h1>
        <p className="mt-6 text-base sm:text-lg md:text-xl text-slate-600 max-w-2xl mx-auto">
          Meeteazy offers more than just a booking link. Get a smart assistant, easy rescheduling, and a beautiful dashboard that puts you in control.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row justify-center items-center gap-4">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center gap-2.5 px-7 py-3 text-base font-semibold text-white bg-blue-600 rounded-lg transition-all shadow-md hover:shadow-xl hover:-translate-y-1"
          >
            Get Started Free
            <ArrowRight size={20} />
          </Link>
          <Link
            href="/#how-it-works"
            className="inline-flex items-center justify-center px-7 py-3 text-base font-semibold text-slate-700 bg-white rounded-lg transition-all shadow-md hover:shadow-xl hover:-translate-y-1 border border-slate-200"
          >
            Learn More
          </Link>
        </div>
      </div>
    </div>
  </section>
);

const FeatureCard = ({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) => (
  <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-xl transition-shadow border border-slate-100 h-full">
    <div className="flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 text-blue-600 mb-4">
      {icon}
    </div>
    <h3 className="text-lg font-semibold text-slate-800 mb-2">{title}</h3>
    <p className="text-slate-600 text-sm leading-relaxed">{children}</p>
  </div>
);

const FeaturesSection = () => (
  <section id="features" className="py-20 sm:py-28 bg-slate-50">
    <div className="container mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center max-w-3xl mx-auto mb-12">
        <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">Core Features for Seamless Scheduling</h2>
        <p className="mt-4 text-lg text-slate-600">
          Everything you need to manage your bookings efficiently and professionally.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-8 max-w-4xl mx-auto">
        <FeatureCard icon={<LinkIcon size={24} />} title="Personal Booking Link">
          Get a public `/u/[username]` page with your details. Share one link to let others book time with you effortlessly.
        </FeatureCard>
        <FeatureCard icon={<Users size={24} />} title="Booking Management">
          A powerful dashboard to view, accept, decline, or cancel bookings. Keep track of all your appointments with status labels.
        </FeatureCard>
        <FeatureCard icon={<BrainCircuit size={24} />} title="Smart Dashboard Assistant">
          Your UI assistant suggests actions like setting up your profile and shows upcoming meetings and pending tasks.
        </FeatureCard>
        <FeatureCard icon={<CalendarDays size={24} />} title="Automated Confirmations">
          Reduce no-shows with automated email confirmations and calendar events sent to you and your attendees on booking changes.
        </FeatureCard>
      </div>
    </div>
  </section>
);

// --- NEW SECTION: Real Capabilities ---
const Capability = ({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) => (
    <div className="flex items-start gap-4">
        <div className="flex-shrink-0 mt-1 text-blue-600">{icon}</div>
        <div>
            <h4 className="font-semibold text-slate-800">{title}</h4>
            <p className="text-slate-600 text-sm">{children}</p>
        </div>
    </div>
);

const RealCapabilitiesSection = () => (
    <section id="capabilities" className="py-20 sm:py-28 bg-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
                <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">Real Capabilities in Action</h2>
                <p className="mt-4 text-lg text-slate-600">
                    Meeteazy is packed with practical features that just work. Here’s what you can do right now.
                </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12 max-w-6xl mx-auto">
                <Capability icon={<Sparkles size={22} />} title="Smart Assistant in Dashboard">
                    Get helpful prompts for setting up your profile, managing pending bookings, and seeing your day at a glance.
                </Capability>
                <Capability icon={<CalendarSync size={22} />} title="Reschedule Bookings">
                    Plans change. Easily propose a new time or cancel a booking, and we’ll handle notifying the other person.
                </Capability>
                <Capability icon={<CalendarRange size={22} />} title="Month View of Bookings">
                    See all your confirmed appointments in a clean, filterable monthly calendar right in your dashboard.
                </Capability>
                <Capability icon={<Globe size={22} />} title="Public Booking Page">
                    Your personal `/u/username` page is ready to share the moment you sign up. Simple, clean, and effective.
                </Capability>
                <Capability icon={<UserCog size={22} />} title="Editable Public Profile">
                    Add a profile photo, write a bio, and list your personal goals to make your booking page truly yours.
                </Capability>
                <Capability icon={<MailCheck size={22} />} title="Email Confirmations">
                    Booking confirmations, rescheduling notices, and cancellation alerts are sent automatically. No setup needed.
                </Capability>
                <Capability icon={<ListChecks size={22} />} title="Booking Requests with Status">
                    All incoming requests appear in your dashboard with `pending`, `accepted`, or `declined` statuses for clear tracking.
                </Capability>
            </div>
        </div>
    </section>
);


const HowItWorksSection = () => (
  <section id="how-it-works" className="py-20 sm:py-28 bg-slate-50">
    <div className="container mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center max-w-2xl mx-auto mb-16">
        <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">Get Started in 3 Simple Steps</h2>
        <p className="mt-4 text-lg text-slate-600">
          From setup to your first booking in just a few minutes.
        </p>
      </div>
      <div className="grid md:grid-cols-3 gap-10 md:gap-8 text-center">
        <div className="flex flex-col items-center">
          <div className="flex items-center justify-center h-16 w-16 rounded-full bg-blue-600 text-white font-bold text-2xl mb-4 shadow-lg">1</div>
          <h3 className="text-xl font-semibold text-slate-800 mb-2">Set Your Availability</h3>
          <p className="text-slate-600">Define your available time slots to create your personal booking page.</p>
        </div>
        <div className="flex flex-col items-center">
          <div className="flex items-center justify-center h-16 w-16 rounded-full bg-blue-600 text-white font-bold text-2xl mb-4 shadow-lg">2</div>
          <h3 className="text-xl font-semibold text-slate-800 mb-2">Share Your Link</h3>
          <p className="text-slate-600">Share your unique Meeteazy link via email, social media, or on your website.</p>
        </div>
        <div className="flex flex-col items-center">
          <div className="flex items-center justify-center h-16 w-16 rounded-full bg-blue-600 text-white font-bold text-2xl mb-4 shadow-lg">3</div>
          <h3 className="text-xl font-semibold text-slate-800 mb-2">Get Booked</h3>
          <p className="text-slate-600">Visitors pick a time, and the event is automatically added to your calendars after your approval.</p>
        </div>
      </div>
    </div>
  </section>
);

const Footer = () => (
  <footer className="bg-slate-900 text-slate-400">
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex flex-col md:flex-row justify-between items-center gap-8">
        <div className="text-center md:text-left">
          <Link href="/" className="flex items-center justify-center md:justify-start gap-2.5 mb-4">
            <BookUser className="w-7 h-7 text-blue-500" />
            <span className="text-xl font-bold text-white tracking-tight">Meeteazy</span>
          </Link>
          <p className="text-sm">Effortless scheduling for busy professionals.</p>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-200 tracking-wider uppercase text-center md:text-left">Legal</h3>
          <ul className="mt-4 flex gap-x-6 md:gap-x-4 lg:gap-x-6 justify-center md:justify-start">
            <li><Link href="/legal/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
            <li><Link href="/legal/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
          </ul>
        </div>
      </div>
      <div className="mt-10 pt-8 border-t border-slate-700 text-center text-sm">
        <p>&copy; {new Date().getFullYear()} Meeteazy. All rights reserved.</p>
      </div>
    </div>
  </footer>
);