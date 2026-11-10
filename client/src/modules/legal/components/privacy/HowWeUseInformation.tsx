export function HowWeUseInformation() {
  return (
    <section id="how-we-use-information" className="mb-8">
      <h2 className="mb-4 text-2xl font-bold text-slate-900">How We Use Your Information</h2>
      <p className="mb-4 leading-relaxed text-slate-600">
        We use the collected information for purposes including:
      </p>
      <ul className="list-disc space-y-2 pl-6 text-slate-600">
        <li>To provide, maintain, and improve our services</li>
        <li>To process bookings and payments</li>
        <li>To send booking confirmations and updates</li>
        <li>To communicate with you about your account or transactions</li>
        <li>To provide customer support</li>
        <li>
          To detect, investigate, and prevent fraud, abuse, or unauthorized activity, including
          sharing information with fraud-prevention and law-enforcement bodies where necessary
        </li>
        <li>To comply with legal, regulatory, and tax obligations</li>
        <li>To send marketing communications (you may opt out at any time)</li>
        <li>To analyze usage patterns and improve user experience</li>
        <li>To enforce our Terms of Service and this Policy</li>
      </ul>

      <h3 className="mb-3 mt-6 text-xl font-semibold text-slate-900">WhatsApp</h3>
      <p className="mb-4 leading-relaxed text-slate-600">
        If you tick the WhatsApp box when you sign up, or switch it on in Settings, we use the phone
        number on your account to send booking updates (confirmed, cancelled, moved or a reminder)
        on WhatsApp. We record when and where you agreed. You can withdraw at any time in Settings,
        or by replying STOP to any of our WhatsApp messages, and we will stop.
      </p>
      <p className="mb-4 leading-relaxed text-slate-600">
        If you message our WhatsApp number yourself, an AI assistant replies. It tells you it is an
        AI and asks you not to share medical, identity or payment details. You can type, or send a
        voice note, a photo or a PDF. A voice note, photo or PDF is sent to the AI provider
        described under AI Features and Model Providers and turned into text (what was said, or a
        short description of what the photo or PDF shows and any text that matters, such as a
        tournament circular). We do not keep the audio, the image or the file, only that text.
        Please do not send a photo or PDF of an identity, medical or bank document; the assistant
        will not read one that is mainly such a document.
      </p>
      <p className="mb-4 leading-relaxed text-slate-600">
        What we keep from these chats, and for how long:
      </p>
      <ul className="mb-4 list-disc space-y-2 pl-6 text-slate-600">
        <li>
          <span className="font-semibold">The chat itself</span>, for 90 days after your last
          message, so the assistant can follow the thread.
        </li>
        <li>
          <span className="font-semibold">Notes about your children</span> that you tell it (first
          name, age, sport, level, goal and state), for up to 12 months, so you do not have to
          repeat them. Nothing is added to a profile unless you open the link we send and confirm it
          on the website. Ask &quot;what do you remember&quot; to see the notes, or
          &quot;forget&quot; to remove them.
        </li>
        <li>
          <span className="font-semibold">A record of each question</span>: what you asked, what the
          assistant answered, what the child&apos;s age, sport, level and your city were, and how it
          ended. Our team can read these records for up to 6 months to review and improve
          PowerMySport and to follow up with you about your question.
        </li>
        <li>
          <span className="font-semibold">Your phone number, with each question record</span>,
          encrypted, so our team can reply to you on WhatsApp, for example with coaches or academies
          near you. Staff can see it only by asking the system to show it or by sending you a
          message from the admin panel, and each time is logged. It is deleted with the record after
          6 months. To recognise you in the next message we also keep a one-way hash of the number,
          which cannot be turned back into a number.
        </li>
      </ul>
      <p className="leading-relaxed text-slate-600">
        Replying STOP deletes the chat, the notes, the question records and any number we kept, and
        stops our WhatsApp messages. WhatsApp is run by Meta Platforms, which handles messages on
        its own platform under its own terms and privacy policy.
      </p>
    </section>
  );
}
