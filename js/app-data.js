/* Yuki web dashboard / mock data. INVENTED people and data only: this site will be public.
   In the real build none of this lives in the cloud: the PC streams these shapes through the encrypted relay
   (Supabase Realtime channel `pc:<device_id>`, payloads sealed end to end) and the browser keeps them in memory only. */
window.YD = {
  user: { name: 'Alex Rivera', first: 'Alex', email: 'alex@example.com', initial: 'A' },
  pc: { name: 'DESKTOP-4KD7Q2M', os: 'Windows 11', app: 'Yuki 0.9.2', linked: 'Today, 14:06', lastSeen: '14:06', ai: 'Claude', aiVia: 'Anthropic, with your key', voice: 'On · wake word “Yuki”' },
  today: 'Monday 5 Oct',
  clock: '14:12',
  now: {
    front: { label: 'In front · since 13:48', title: 'Figma · Onboarding flow v3', note: 'Screen 4 of 7. You renamed two frames a minute ago.' },
    playing: { label: 'Playing · paused', title: 'Slow Morning', note: 'Nell Ash · Spotify, paused at 13:40' },
    next: { label: 'Next · 15:30', title: 'Budget review with Priya', note: 'Google Meet · in 1 h 18 m. Her sheet isn’t in yet.' }
  },
  list: [
    { t: 'Reply to Noor about the venue', due: 'today', src: 'from Mail, 09:14', hot: true },
    { t: 'Send Leo the Q4 deck', due: 'Friday', src: 'you said it on a call with Leo, 2 Oct' },
    { t: 'Book the dentist', due: 'tomorrow', src: 'you asked by voice, Thursday' },
    { t: 'Renew passport photos', due: 'next week', src: 'you typed it here, 1 Oct' },
    { t: 'Water the fern', due: 'Sunday', src: 'from a page you read, 09:12' }
  ],
  done: [{ t: 'Send Sam the call notes', when: '11:02' }, { t: 'Pay the electricity bill', when: 'yesterday' }],
  said: [
    { t: 'Send Leo the Q4 deck', to: 'Leo Park', when: 'by Friday', src: 'call with Leo · 2 Oct' },
    { t: 'Look at Sam’s draft', to: 'Sam Okafor', when: 'before 16:00', src: 'Slack · 11:20' },
    { t: 'Bring the Lisbon photos', to: 'Maya Chen', when: 'Thursday lunch', src: 'call with Maya · 1 Oct' },
    { t: 'Share the venue shortlist', to: 'Noor Haddad', when: 'this week', src: 'Weekly sync · today' }
  ],
  waiting: [
    { who: 'Priya Shah', t: 'The budget sheet', since: 'was due Friday', src: 'Slack · 1 Oct · again in the weekly sync today', late: true },
    { who: 'Jonas Berg', t: 'Final logo files', since: 'asked a week ago', src: 'Mail · 28 Sep' },
    { who: 'Leo Park', t: 'Feedback on the pricing page', since: 'said “after the weekend”', src: 'call · 2 Oct' }
  ],
  replies: [
    { who: 'Maya Chen', t: 'Are we still on for lunch Thursday?', app: 'Messages', ago: '2 h' },
    { who: 'Sam Okafor', t: 'Can you look at my draft before 4?', app: 'Slack', ago: '3 h' },
    { who: 'Noor Haddad', t: 'Venue options for the offsite', app: 'Mail', ago: '5 h' }
  ],
  // the day, 08:00 to 20:00
  day: [
    { a: '09:02', b: '09:40', t: 'Mail and calendar', k: 'work', apps: 'Outlook, Calendar', did: 'Answered 6 emails. Looked at dentist times for tomorrow.' },
    { a: '09:40', b: '10:12', t: 'Weekly sync', k: 'call', apps: 'Microsoft Teams', did: '32 min, both sides recorded. You took the venue task.' },
    { a: '10:15', b: '12:30', t: 'Onboarding flow v3', k: 'work', apps: 'Figma', did: 'Screens 1 to 4. Longest stretch today: 1 h 42 m.' },
    { a: '12:30', b: '13:20', t: 'Away', k: 'away', apps: '', did: 'Lunch.' },
    { a: '13:20', b: '13:48', t: 'Messages and notes', k: 'work', apps: 'Slack, Notion', did: 'Sam asked for a review. You saved two ideas.' },
    { a: '13:48', b: 'now', t: 'Onboarding flow v3', k: 'work', apps: 'Figma, Spotify', did: 'Screen 4. Music paused at 13:40.', live: true }
  ],
  calls: [
    { title: 'Weekly sync', app: 'Microsoft Teams', when: 'Today · 09:40', len: '32 min', who: 'You, Sam, Noor, Priya',
      lines: [
        { s: 'Sam', t: 'Venue is the last open thing for the offsite.' },
        { s: 'You', t: 'I can pull a shortlist together this week.' },
        { s: 'Noor', t: 'Great. Under forty people, near a station.' },
        { s: 'Priya', t: 'Sorry the budget sheet is late. You’ll have it before our review at 15:30.' }
      ],
      out: { said: 'Share the venue shortlist with Noor · this week', owed: 'Priya: the budget sheet · before 15:30 today' } },
    { title: 'Leo Park', app: 'Discord', when: 'Fri 2 Oct · 18:10', len: '8 min', who: 'You and Leo',
      lines: [
        { s: 'Leo', t: 'Could you send the Q4 deck by next Friday?' },
        { s: 'You', t: 'Yes, I’ll send it by Friday.' },
        { s: 'Leo', t: 'I’ll look at the pricing page after the weekend.' }
      ],
      out: { said: 'Send Leo the Q4 deck · by Friday', owed: 'Leo: pricing page feedback · after the weekend' } },
    { title: 'Maya Chen', app: 'WhatsApp', when: 'Thu 1 Oct · 12:05', len: '3 min', who: 'You and Maya',
      lines: [{ s: 'Maya', t: 'Lunch next Thursday? The place near the park.' }, { s: 'You', t: 'Perfect. I’ll bring the Lisbon photos.' }],
      out: { said: 'Bring the Lisbon photos · Thursday', owed: '' } }
  ],
  memory: [
    { k: 'people', t: 'Maya Chen is a friend from design school. She likes mornings.', src: 'Messages', d: '4 Oct' },
    { k: 'people', t: 'Leo Park works at Northwind and prefers email to chat.', src: 'Mail', d: '28 Sep' },
    { k: 'people', t: 'Priya Shah runs the budget for the offsite.', src: 'Weekly sync', d: 'today' },
    { k: 'people', t: 'Sam Okafor is on your team. Reviews go to him on Fridays.', src: 'Slack', d: '30 Sep' },
    { k: 'promises', t: 'You told Leo you’d send the Q4 deck by Friday.', src: 'call with Leo', d: '2 Oct' },
    { k: 'promises', t: 'Priya said she’d send the budget sheet by Friday. Today she said before 15:30.', src: 'Slack, then the weekly sync', d: 'today' },
    { k: 'places', t: 'Nori is the lunch place near the park. Maya’s pick.', src: 'Messages', d: '1 Oct' },
    { k: 'places', t: 'Your dentist is Dr. Ortiz on Elm Street.', src: 'Mail', d: '26 Sep' },
    { k: 'pages', t: 'You read “How to repot a fern” for 6 minutes.', src: 'Chrome', d: '09:12' },
    { k: 'pages', t: 'You compared three offsite venues on Peerspace.', src: 'Chrome', d: 'yesterday' },
    { k: 'prefs', t: 'You like quiet music while you design. Lo-fi, no vocals.', src: 'Spotify', d: 'this week' },
    { k: 'prefs', t: 'You don’t want break nudges during calls or games.', src: 'you said it to Yuki', d: '27 Sep' }
  ],
  memCats: [['all', 'All'], ['people', 'People'], ['promises', 'Promises'], ['places', 'Places'], ['pages', 'Pages'], ['prefs', 'Likes']]
};
