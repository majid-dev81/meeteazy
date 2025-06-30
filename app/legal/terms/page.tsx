// app/legal/terms/page.tsx

export default function TermsOfServicePage() {
  return (
    <div className="bg-white min-h-screen font-sans">
      {/* Header Section */}
      <header className="bg-slate-50 border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">
            Terms of Service
          </h1>
          <p className="mt-2 text-lg text-slate-600">
            Effective date: June 30, 2025
          </p>
        </div>
      </header>

      {/* Main Content Section */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="prose prose-slate max-w-none">
          <p>
            Please read these Terms of Service ("Terms", "Terms of Service") carefully before using the https://meeteazy.com website and the Meeteazy scheduling service (the "Service") operated by Meeteazy ("us", "we", or "our").
          </p>
          <p>Your access to and use of the Service is conditioned on your acceptance of and compliance with these Terms. These Terms apply to all visitors, users, and others who access or use the Service.</p>

          <h2>1. Agreement to Terms</h2>
          <p>
            By accessing or using our Service, you agree to be bound by these Terms and our Privacy Policy. If you disagree with any part of the terms, then you may not access the Service.
          </p>

          <h2>2. Description of Service</h2>
          <p>
            Meeteazy provides a platform designed to simplify appointment and meeting scheduling. The Service connects to your personal calendar to automatically check availability and help you schedule meetings without back-and-forth emails.
          </p>
          
          <h2>3. User Accounts</h2>
          <p>
            When you create an account with us, you must provide information that is accurate, complete, and current at all times. Failure to do so constitutes a breach of the Terms, which may result in immediate termination of your account on our Service.
          </p>
          <p>
            You are responsible for safeguarding the password that you use to access the Service and for any activities or actions under your password, whether your password is with our Service or a third-party service. You agree not to disclose your password to any third party. You must notify us immediately upon becoming aware of any breach of security or unauthorized use of your account.
          </p>

          <h2>4. User Conduct and Responsibilities</h2>
          <p>You agree not to use the Service to:</p>
            <ul>
                <li>Violate any local, state, national, or international law.</li>
                <li>Transmit any material that is abusive, harassing, defamatory, vulgar, or otherwise objectionable.</li>
                <li>Impersonate any person or entity, or falsely state or otherwise misrepresent your affiliation with a person or entity.</li>
                <li>Transmit any material that contains software viruses or any other computer code, files, or programs designed to interrupt, destroy, or limit the functionality of any computer software or hardware or telecommunications equipment.</li>
            </ul>

          <h2>5. Intellectual Property</h2>
          <p>
            The Service and its original content (excluding content provided by users), features, and functionality are and will remain the exclusive property of Meeteazy and its licensors. The Service is protected by copyright, trademark, and other laws of both the United States and foreign countries. Our trademarks and trade dress may not be used in connection with any product or service without the prior written consent of Meeteazy.
          </p>

          <h2>6. Termination</h2>
          <p>
            We may terminate or suspend your account immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms. Upon termination, your right to use the Service will immediately cease. If you wish to terminate your account, you may simply discontinue using the Service or delete your account from your settings page.
          </p>

          <h2>7. Disclaimer of Warranties</h2>
           <p>Your use of the Service is at your sole risk. The Service is provided on an "AS IS" and "AS AVAILABLE" basis. The Service is provided without warranties of any kind, whether express or implied, including, but not limited to, implied warranties of merchantability, fitness for a particular purpose, non-infringement, or course of performance.</p>

          <h2>8. Limitation of Liability</h2>
          <p>
            In no event shall Meeteazy, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from (i) your access to or use of or inability to access or use the Service; (ii) any conduct or content of any third party on the Service; (iii) any content obtained from the Service; and (iv) unauthorized access, use, or alteration of your transmissions or content, whether based on warranty, contract, tort (including negligence), or any other legal theory, whether or not we have been informed of the possibility of such damage.
          </p>
          
          <h2>9. Governing Law</h2>
          <p>These Terms shall be governed and construed in accordance with the laws of the State of Delaware, United States, without regard to its conflict of law provisions.</p>

          <h2>10. Changes to Terms</h2>
          <p>We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material, we will provide at least 30 days' notice prior to any new terms taking effect. What constitutes a material change will be determined at our sole discretion. By continuing to access or use our Service after those revisions become effective, you agree to be bound by the revised terms.</p>

          <h2>11. Contact Us</h2>
          <p>If you have any questions about these Terms, please contact us at support@meeteazy.com.</p>
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
