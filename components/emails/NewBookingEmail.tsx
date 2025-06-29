import {
  Body,
  Button,
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

interface NewBookingEmailProps {
  ownerName: string
  requesterName: string
  requesterEmail: string
  requesterPhone?: string
  date: string
  time: string
  duration: number
  subject?: string
  dashboardUrl?: string
}

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export const NewBookingEmail = ({
  ownerName,
  requesterName,
  requesterEmail,
  requesterPhone,
  date,
  time,
  duration,
  subject,
  dashboardUrl = `${baseUrl}/dashboard`,
}: NewBookingEmailProps) => {
  const previewText = `New booking request from ${requesterName}`

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
              Hi {ownerName},
            </Text>
            <Text className="text-gray-600 text-lg leading-relaxed">
              You have a new meeting request from <strong>{requesterName}</strong>.
            </Text>
            <Section className="my-6 p-6 border border-gray-200 rounded-md bg-gray-50">
              <Heading as="h2" className="text-xl font-semibold text-gray-700 mt-0">
                Booking Details
              </Heading>
              <Text className="text-gray-800 m-0"><strong>Requester:</strong> {requesterName}</Text>
              <Text className="text-gray-800 m-0"><strong>Email:</strong> {requesterEmail}</Text>
              {requesterPhone && <Text className="text-gray-800 m-0"><strong>Phone:</strong> {requesterPhone}</Text>}
              <Hr className="border-gray-300 my-4" />
              <Text className="text-gray-800 m-0"><strong>Date:</strong> {new Date(date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</Text>
              <Text className="text-gray-800 m-0"><strong>Time:</strong> {time}</Text>
              <Text className="text-gray-800 m-0"><strong>Duration:</strong> {duration} minutes</Text>
              {subject && <Text className="text-gray-800 mt-4"><strong>Subject:</strong><br />{subject}</Text>}
            </Section>
            <Section className="text-center mt-8">
              <Button
                href={dashboardUrl}
                className="bg-blue-600 text-white font-semibold rounded-md text-base px-6 py-3"
              >
                View in Dashboard
              </Button>
            </Section>
            <Text className="text-gray-500 text-sm mt-8">
              You can accept or decline this request from your Meeteazy dashboard.
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

export default NewBookingEmail