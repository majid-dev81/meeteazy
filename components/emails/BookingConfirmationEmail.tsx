import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Heading,
  Preview,
  Section,
  Text,
  Tailwind,
} from '@react-email/components'
import * as React from 'react'

interface BookingConfirmationEmailProps {
  recipientName: string
  recipientType: 'owner' | 'requester'
  ownerName: string
  requesterName: string
  date: string
  time: string
  duration: number
  subject?: string
  location?: string
}

export const BookingConfirmationEmail = ({
  recipientName,
  recipientType,
  ownerName,
  requesterName,
  date,
  time,
  duration,
  subject = 'Meeting Details',
  location = 'To be specified',
}: BookingConfirmationEmailProps) => {
  const previewText = `Confirmed: Your meeting on ${new Date(date).toLocaleDateString()}`

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className="bg-gray-100 font-sans">
          <Container className="bg-white border border-gray-200 rounded-lg shadow-sm my-10 mx-auto p-8 max-w-xl w-full">
            <Heading className="text-2xl font-bold text-gray-800 text-center">
              Meeteazy
            </Heading>
            <Text className="text-gray-600 text-lg leading-relaxed">
              Hi {recipientName},
            </Text>
            <Text className="text-green-600 text-lg font-semibold leading-relaxed">
              ✅ This meeting is confirmed.
            </Text>
            <Text className="text-gray-600 text-lg leading-relaxed">
              {recipientType === 'requester'
                ? `Your meeting with ${ownerName} has been scheduled.`
                : `A new meeting with ${requesterName} has been added to your schedule.`}
            </Text>
            <Section className="my-6 p-6 border border-gray-200 rounded-md bg-gray-50">
              <Heading as="h2" className="text-xl font-semibold text-gray-700 mt-0">
                Meeting Details
              </Heading>
              <Text className="text-gray-800 m-0"><strong>Title:</strong> {subject}</Text>
              <Text className="text-gray-800 m-0"><strong>With:</strong> {ownerName} and {requesterName}</Text>
              <Hr className="border-gray-300 my-4" />
              <Text className="text-gray-800 m-0"><strong>Date:</strong> {new Date(date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</Text>
              <Text className="text-gray-800 m-0"><strong>Time:</strong> {time}</Text>
              <Text className="text-gray-800 m-0"><strong>Duration:</strong> {duration} minutes</Text>
              <Text className="text-gray-800 m-0"><strong>Location:</strong> {location}</Text>
            </Section>
            <Text className="text-gray-500 text-sm mt-8">
              A calendar invite has been attached to this email. You can add it to your calendar (Google, Outlook, Apple Calendar) to get a reminder.
            </Text>
            <Hr className="border-gray-200 my-6" />
            <Text className="text-gray-400 text-xs text-center">
              Meeteazy | The easiest way to meet.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}

export default BookingConfirmationEmail