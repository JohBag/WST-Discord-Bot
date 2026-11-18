# Roadmap

What's built, what's parked and why. Newest first. This repo is public: describe situations, never
quote guild members or name them.

## 2026-11-17: Reminders

Members ask Botty to remind them of something later, with `/remind` or in chat, and list or cancel
what's set.

- **Who it's for.** Anyone can set a reminder for themselves. Officers can also set one for the
  channel (pings @here, the members online, changed from no ping after the local test, 2026-11-18)
  or a role (pings the role). Both need the bot to be able to ping it, checked when it's set. Reminding another member isn't offered.
- **`/remind`** takes a time and what to remind about, with an optional For (Me, or This channel
  for officers) and Role (officers: pings that role). One command with a dropdown, not one per
  target (changed after the first local test, 2026-11-17). Times are a duration (`2h`, `1d 3h`, `in half an hour`, `1.5h`) or a clock time and day in EU
  server time (`19:30`, `at 7pm`, `fri 19:30`, `26/11 19:30`), the forms `/event create` takes plus
  a few more. A clock time already passed today means tomorrow, whole days keep the clock time
  across a daylight saving change, and a bare number is refused as ambiguous (minutes or a time).
  The confirmation is a card (what, When as a Discord timestamp, For), so a misread time is caught
  there. In chat the card is public and turns grey once the reminder is sent (with a link to it) or
  cancelled.
- **`/reminders`** shows your reminders (with the channel when it's another one) and the channel
  and role reminders set in this channel, with a menu to cancel. Members cancel their own, officers
  also anyone's channel and role reminders. Other members' own reminders are never shown.
- **In chat**, the model has `set_reminder`, `list_reminders` and `cancel_reminder`. Each reminder
  has a number (#12) shown in the confirmation and the list, so "cancel that" finds it in the
  channel. The model names who asked, and that person must have spoken to Botty in the recent
  messages it sees: the reminder is theirs, with their rights, and a name that matches nobody is
  refused. The tools are off when Botty joins in uninvited. Known limit: which of several people
  asked is the model's call, so a member could talk it into naming an officer who also spoke to
  Botty. `/remind` has no such gap. Listing in chat shows only what fires in this channel, since
  everyone sees it. The system prompt now carries the current date and time in server time, which
  chat reminders need and which also helps with "what day is it" questions.
- **The reminder itself stays plain text**, so it reads like Botty talking and the ping sits in the
  line (decided 2026-11-17).
- **When it fires**, Botty posts in the channel it was set in, as a reply to the asking message
  when it was set in chat. The ping comes first, then the reminder reworded in Botty's voice (one
  model call). When the model fails or takes over 30 seconds, it's posted as written. Only the
  member or role it's for can be pinged, whatever the text says.
- **Storage:** the git-ignored `config/reminders.json`, checked every 30 seconds. One that came due
  while Botty was offline is posted at startup with when it was due. At most 10 per member, a year
  ahead and 500 characters.

### Not doing

- **Repeating reminders.** Raid nights already get the sign-up post's ping an hour before, which
  was the main repeating case. Decided 2026-11-17.
- **Direct messages.** DMs can be turned off, and a channel post links back to where it was set.
- **Reminding another member.** Avoids members pinging each other through Botty.

## 2026-11-16: Raid and event sign-ups

Raid-Helper-style sign-ups for WoW retail and WoW Forever, built into Botty instead of adding a
separate bot, so sign-ups carry real character names. The design, every decision and how each part
works are in `docs/events.md`. In short:

- Members save their characters once with `/characters`. Retail realms are checked against the EU
  realm list the Raid-Helper Helper addon uses.
- Officers post a raid or event with `/event create`, in the channel where they use it. Members sign
  up with one click on their main, and switch character, spec or role under My sign-up. Clicking
  Interested in the server's Events tab signs them up too.
- Each post has an entry in the Events tab, an hour-before reminder that officers can switch off,
  and, for retail raids, a link to that night's Warcraft Logs report.
- Raids can repeat every week. Officers export the roster for the addon's raid invites.

### Not doing

- **A web view or comp tool**, and picking the roster and groups. See `docs/events.md`.
- **Our own WoW Forever invite addon.** Planned as a separate project. Until then Forever raids
  export a plain list of names.

## 2026-11-13: Old context after a long pause

To give some context in quiet channels, Botty's history keeps at least 10 messages even across a long
pause (`chat.history.minMessages`). The model couldn't tell those were old: on 2026-10-29 he fitted a
newcomer's question into a plan from two hours earlier, and on 2026-11-13 a random reply in a quiet
channel picked up the previous day's conversation instead of the new message.

- A pause of more than 60 minutes (`chat.history.gapMinutes`) shows in what the model reads as a line
  like `(14 hours later)` before the message that ends it. Only before other people's messages, so
  the model doesn't learn to start its own replies with one: a pause that ends with Botty's own post
  (a `/log` summary the next morning) is marked before the next person's message instead, timed from
  the last message before the pause.
- A random reply reads only the conversation going on now, back to the last pause. A ping or a reply
  still keeps the 10, with the pause marked.

### Not doing

- **An age limit on the kept messages.** The fix proposed when this was parked. It would also have
  stopped both incidents, but it drops context that helps when someone pings Botty about something
  earlier in a quiet channel. Marking the pause keeps that context and still shows it as old.

## 2026-11-11: Promoting and demoting members

Officers move a member one rank up (Visitor to Probationer to Member) with `/promote` or by
right-clicking the member > Apps > Promote, and one rank down with `/demote` or Apps > Demote.
The new rank replaces the old one, in a single role change. Only the officer sees the reply.
Members with the Officer role can use them, checked by Botty, so the commands show for everyone but
refuse non-officers. Officers, and anyone with a role above Officer, can't be demoted, not even by
themselves: taking one down stays a manual job for whoever runs the server. Whoever runs the server can hide the commands from
non-officers under Server Settings > Integrations. Botty's role has to sit above every rank in the role list.
Otherwise he changes nothing and tells the officer which rank is in the way.

### Not doing

- **Announcing rank changes.** Silent for now (decided 2026-11-11). A short line in a guild channel is
  the obvious next step.
- **Changing ranks through chat.** "Botty, promote X" is left out on purpose: members could talk the
  model into it. The commands' officer check is the only way in.

## 2026-10-29: Chat reads more of Discord

Built after a day of botty-chat where Botty answered twice, missed what people pointed at and
answered messages meant for others.

- Waits while anyone in the channel shows "is typing" (up to 10 seconds) before reading, so a second
  line gets answered with the first. A follow-up sees Botty's earlier reply right after the last
  message that reply had read, so it only answers what's new.
- Mentions, role and channel links and custom emoji read as names instead of IDs.
- Discord replies show what they reply to, shortened.
- The newest 3 pictures in the conversation go to the model, including GIFs and link preview
  pictures. Older pictures, videos and files are noted as `[picture]`, `[video]`, `[file]`.
- Link previews show their title and description.
- In channels where Botty answers everything, a message that replies to or pings someone else, and
  doesn't name Botty, gets no reply. A reply to one of Botty's messages always counts as talking to him.
- Prompt tuned against habits that afternoon: emoji only when they add tone, names only when it's
  unclear who he's talking to, varied openings, no questions just to keep the chat going, no repeated
  points, new games count as current. Checked blind against the old prompt on 20 conversations.

### Not doing

- **Watching videos.** Botty only gets a video's preview title, description and picture (decided
  2026-10-29). Having Gemini watch the first minutes and describe them was the alternative: it
  catches visual memes, for a small cost per video. Fetching YouTube transcripts was ruled out:
  Shorts often have none, it misses anything visual, and YouTube often blocks cloud servers.
- **Reading linked web pages.** Only the preview is read. Claude's web fetch tool could open links.

## Parked

### Memory

Botty only sees the current channel's conversation: back to the last 60-minute pause, at most 3 days
and 50 messages. Members keep referring to things he took part in earlier or in other channels:
nicknames, running jokes, plans. Seen on 2026-10-29: asked to recall a nickname from an earlier
conversation, and asked to "save" a nickname and use it from now on.

Directions to weigh:
- Notes per member and for the guild that the model writes through a tool ("remember this") and gets
  in the prompt when that member is in the conversation.
- Summaries of past conversations per channel, written when a conversation ends.
- A search tool over message history, so Botty looks things up when someone refers back.

Questions to settle first:
- Who can see, change or delete what Botty remembers, and how a member opts out.
- Pranks: members will try to make Botty remember things about others (a nickname for someone who
  never agreed to it). He held out against that in chat on 2026-10-29, but stored notes last.
- Where it lives (git-ignored, like `config/warcraft-logs-posts.json`) and what it costs per reply.

### Language

Botty answers in the language he's written to. Undecided whether that's wanted in a guild that
mostly talks in English.
