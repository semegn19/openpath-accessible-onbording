# Roha - 3-Minute Demonstration Script

**Digital Bridge Accessibility Hackathon 2026 (Track 1)**  
*Demonstrator Guide & Evaluator Walkthrough*

---

## Preparation (30 Seconds Before Demo)
1. Start the stack:
   ```bash
   docker compose up -d --build
   # OR
   cd app && npm run dev
   ```
2. Open Chrome at: `http://localhost:5173/onboard`
3. Ensure your local Ollama server is running with `llama3.2:1b` (optional, since local rules work offline!).

---

## Part 1: Embedding & Activating Voice (30 Seconds)

1. **Point out the embedding:**
   - *"Roha is packaged as an embeddable component (~70 KB) that runs inside Savanna (`/onboard`) or an independent blank HTML page (`/blank-host.html`) using `<roha-agent>`."*
2. **Enable Voice:**
   - Tap the purple **"🎙️ Roha Voice"** pill or click **"🎙️ Enable Voice"** on the floating card.
   - When the browser asks for microphone access, click **Allow**.
   - The status badge turns to `● LISTENING`.
3. **Voice Text Zoom & Plain Language:**
   - Say: *"Make words bigger"* (or click **🔍 Bigger Text**). The font scales to 150%.
   - Say: *"Simple words"* (or click **💡 Simple Words**). The wording simplifies instantly without altering meaning.

---

## Part 2: Signature Experience 1 — “I’m Stuck” (45 Seconds)

1. **Triggering the Barrier:**
   - Say: *"I'm stuck"* or click the **"❓ I'm Stuck"** button on the Roha panel.
   - Say: *"I don't have a national ID document"* (or in Amharic: *"መታወቂያ የለኝም"*).
2. **Observing Roha's Response:**
   - Roha announces:
     > *“Standard national ID is not required. You can choose a Refugee ID, Kebele letter, or our no-document partner referral route.”*
   - Roha navigates to the Identity Route step and presents the approved alternative options.
3. **Completing the Referral Route:**
   - Select **“No Document / Partner Referral”** (`ወደ አጋር መመራት`).
   - The referral consent screen confirms that the learner will be connected to an accredited partner organization without needing an official document.

---

## Part 3: Signature Experience 2 — “Check My Answer” & Conversational Correction (45 Seconds)

1. **Read-Back:**
   - Click **"📋 Check Answers"** or say: *"Read all my answers"* / *"Check my answers"*.
   - Roha speaks all currently recorded answers:
     > *“Here are all your recorded answers: 1. Full name: Abebe Bikila. 2. Phone number: 0911223344...”*
2. **Patronymic Partial Name Correction:**
   - Say: *"Keep my first name; change my last name to Kebede"*.
   - Roha preserves the first name and updates the last name to *"Abebe Kebede"*.
3. **Immediate Reversible Undo:**
   - Say: *"Undo that change"*.
   - Roha restores the previous answer (*"Abebe Bikila"*) immediately.
4. **Spoken Number Normalization:**
   - Say your phone number: *"Zero nine one one two two three three four four"*.
   - Roha transcribes and normalizes it into digits: `0911223344`.

---

## Part 4: Signature Experience 3 — “Continue Where I Stopped” & Offline Outbox (30 Seconds)

1. **Simulate a Dropped Connection:**
   - Turn off Wi-Fi or set Network to **Offline** in Chrome DevTools.
   - Look at the top banner:
     > *“No connection. Your answers are saved on this device; they will submit automatically when connected.”*
2. **Reload the Browser:**
   - Refresh the page `http://localhost:5173/onboard`.
   - Roha immediately restores your exact progress:
     > *“Welcome back. We are on step 6 of 8: Identity route.”*
3. **Reconnect & Idempotent Submission:**
   - Re-enable Wi-Fi.
   - Proceed to review and click **Submit**.
   - Roha flushes the outbox and shows the receipt ID without double-registering.

---

## Part 5: Career Gateway & Private Support Filter (30 Seconds)

1. Navigate to `http://localhost:5173/job`.
2. Notice the **Support Needs** selection:
   - Select *"Wheelchair accessible entrance"* and *"Flexible hours"*, or choose *"Prefer not to say"*.
3. Inspect the final payload preview:
   - The application answers are prepared for the employer.
   - The private support selections are **strictly excluded from the employer payload**, protecting the learner's privacy!

