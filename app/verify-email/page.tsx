// app/verify-email/page.tsx
'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { collection, getDocs, query, where, updateDoc, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase' // ✅ REAL FIREBASE DB

/**
 * @component VerificationContent
 * This component handles the actual verification logic.
 * It uses the useSearchParams hook and is therefore wrapped in Suspense.
 */
function VerificationContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState<'verifying' | 'success' | 'invalid'>('verifying')

  useEffect(() => {
    const verifyToken = async () => {
      const token = searchParams.get('token')
      if (!token) {
        setStatus('invalid')
        return
      }

      try {
        const q = query(collection(db, 'users'), where('verificationToken', '==', token))
        const snapshot = await getDocs(q)

        if (snapshot.empty) {
          setStatus('invalid')
          return
        }

        const userDoc = snapshot.docs[0]
        await updateDoc(doc(db, 'users', userDoc.id), {
          verified: true,
          verificationToken: null,
        })

        setStatus('success')
        setTimeout(() => router.push('/signin'), 2500)
      } catch (err) {
        console.error('Verification failed:', err)
        setStatus('invalid')
      }
    }

    verifyToken()
  }, [searchParams, router])

  return (
    <>
      {status === 'verifying' && (
        <p className="text-gray-600 text-lg">Verifying your email...</p>
      )}
      {status === 'success' && (
        <p className="text-green-600 text-lg font-semibold">✅ Email verified! Redirecting to login...</p>
      )}
      {status === 'invalid' && (
        <p className="text-red-600 text-lg font-semibold">❌ Invalid or expired link</p>
      )}
    </>
  )
}


/**
 * @page VerifyEmailPage
 * This is the main page component for the /verify-email route.
 * It provides a Suspense boundary for the client-side verification logic.
 */
export default function VerifyEmailPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="max-w-md w-full text-center">
        <Suspense fallback={<p className="text-gray-600 text-lg">Verifying your email...</p>}>
          <VerificationContent />
        </Suspense>
      </div>
    </main>
  )
}