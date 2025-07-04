const { Resend } = require('resend')

const resend = new Resend('re_GEYHVpAK_F43zife2PAShiyuDa6qTH9Ac') // your actual key

resend.emails.send({
  from: 'notifications@meeteazy.com',
  to: 'mmajid81@hotmail.com',
  subject: '🔥 Direct test from CLI',
  html: '<strong>This is a direct test. If this works, resend is working.</strong>',
}).then((result) => {
  console.log('✅ Email sent result:', result)
}).catch((error) => {
  console.error('❌ Error sending email:', error)
})