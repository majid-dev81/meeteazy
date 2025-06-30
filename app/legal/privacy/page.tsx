// app/legal/privacy/page.tsx

export default function PrivacyPolicyPage() {
  return (
    <div className="bg-white min-h-screen font-sans">
      {/* Header Section */}
      <header className="bg-slate-50 border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">
            Privacy Policy
          </h1>
          <p className="mt-2 text-lg text-slate-600">
            Last Updated: June 30, 2025
          </p>
        </div>
      </header>

      {/* Main Content Section */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="prose prose-slate max-w-none">
          <p>
            Welcome to Meeteazy! Your privacy is critically important to us. This Privacy Policy outlines how Meeteazy ("we," "us," or "our") collects, uses, protects, and discloses your information when you use our website and scheduling services (collectively, the "Service").
          </p>
          <p>
            By accessing or using our Service, you signify that you have read, understood, and agree to our collection, storage, use, and disclosure of your personal information as described in this Privacy Policy and our Terms of Service.
          </p>

          <h2>1. Information We Collect</h2>
          <p>We collect information that you provide directly to us, information collected automatically through your use of the Service, and information from third-party services.</p>
          <ul>
            <li>
              <strong>Personal Information:</strong> When you create an account, we collect information such as your name, email address, password, and profile picture.
            </li>
            <li>
              <strong>Calendar and Scheduling Information:</strong> To provide our Service, we require access to your calendar data. We collect information about your events, availability, and the details of meetings you schedule, including participant information, event titles, and notes.
            </li>
            <li>
              <strong>Payment Information:</strong> If you subscribe to a paid plan, our third-party payment processor (e.g., Stripe) will collect and store your payment card information. We do not store this information on our servers.
            </li>
            <li>
              <strong>Usage Data:</strong> We automatically collect information about your interactions with our Service, such as the pages you visit, the features you use, IP address, browser type, device information, and timestamps of your access.
            </li>
            <li>
              <strong>Cookies and Similar Technologies:</strong> We use cookies to operate and administer our Site, gather usage data on our Site, and improve your experience. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent.
            </li>
          </ul>

          <h2>2. How We Use Your Information</h2>
          <p>We use the information we collect for various purposes:</p>
          <ul>
            <li>To provide, maintain, and improve our Service.</li>
            <li>To manage your account and send you administrative communications.</li>
            <li>To facilitate scheduling between you and other users.</li>
            <li>To process transactions and send you related information.</li>
            <li>To respond to your comments, questions, and requests for customer support.</li>
            <li>To monitor and analyze trends, usage, and activities in connection with our Service.</li>
            <li>To detect, investigate and prevent fraudulent transactions and other illegal activities and protect the rights and property of Meeteazy and others.</li>
          </ul>

          <h2>3. How We Share Your Information</h2>
          <p>We do not sell your personal information. We may share your information in the following circumstances:</p>
          <ul>
            <li>
              <strong>With other users:</strong> When you schedule a meeting, we share your availability and necessary profile information with the other participants.
            </li>
            <li>
              <strong>Service Providers:</strong> We may share your information with third-party vendors and service providers that perform services on our behalf, such as hosting, payment processing, and analytics. These third parties are obligated to protect your information.
            </li>
            <li>
              <strong>Legal Compliance:</strong> We may disclose your information if required to do so by law or in response to valid requests by public authorities (e.g., a court or a government agency).
            </li>
            <li>
              <strong>Business Transfers:</strong> We may share or transfer your information in connection with, or during negotiations of, any merger, sale of company assets, financing, or acquisition of all or a portion of our business to another company.
            </li>
          </ul>
          
          <h2>4. Data Security</h2>
          <p>We implement a variety of security measures to maintain the safety of your personal information. We use encryption (such as SSL/TLS) to protect data in transit. However, no method of transmission over the Internet or method of electronic storage is 100% secure, and we cannot guarantee its absolute security.</p>
          
          <h2>5. Your Data Protection Rights</h2>
          <p>Depending on your location, you may have the following rights regarding your personal information:</p>
          <ul>
            <li>The right to access, update or delete the information we have on you.</li>
            <li>The right of rectification.</li>
            <li>The right to object to our processing of your personal information.</li>
            <li>The right of restriction.</li>
            <li>The right to data portability.</li>
            <li>The right to withdraw consent at any time.</li>
          </ul>
          <p>You can exercise these rights by accessing your account settings or by contacting us directly.</p>

          <h2>6. Children's Privacy</h2>
          <p>Our Service is not intended for use by children under the age of 13. We do not knowingly collect personally identifiable information from children under 13. If you become aware that a child has provided us with Personal Information, please contact us.</p>
          
          <h2>7. Changes to This Privacy Policy</h2>
          <p>We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date. You are advised to review this Privacy Policy periodically for any changes.</p>
          
          <h2>8. Contact Us</h2>
          <p>If you have any questions about this Privacy Policy, please contact us at:</p>
          <p>
            Email: support@meeteazy.com <br />
            
          </p>
        </div>
      </main>

      {/* Footer Section */}
      <footer className="bg-slate-50 border-t border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-sm text-slate-500">
          <p>&copy; {new Date().getFullYear()} Meeteazy. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
