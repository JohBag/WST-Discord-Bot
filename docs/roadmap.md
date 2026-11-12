# Roadmap

What's built, what's parked and why. Newest first. This repo is public: describe situations, never
quote guild members or name them.

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

### Reminders

Raised 2026-11-12, not built. Ask Botty to remind you or a channel of something later, through a
slash command or in chat, and list or cancel what's set.

Proposed shape:
- **One `/remind` command with subcommands.** `/remind me <when> <what>` and
  `/remind channel <when> <what>` set one. `/remind list` shows yours and the channel's.
  `/remind cancel <reminder>` picks from your own with autocomplete, so nobody types an ID.
  The confirmation is private and shows the time as a Discord timestamp (`<t:…:F>` and `<t:…:R>`),
  which every reader sees in their own time zone. That is where a misread time gets caught.
- **When it fires** Botty posts in the channel it was set in: "Reminder for @member: what", or
  without a ping for a channel reminder, linking the message or command that set it. Only the
  member who set it gets pinged (`allowedMentions`), so a reminder can't be used to mass-ping
  `@everyone` or a role.
- **In chat**, three tools next to `create_vote`: `set_reminder` (time as ISO 8601 with offset,
  text, for the asker or the channel), `list_reminders` and `cancel_reminder` (by number). A tool
  call's message replaces the reply today (`features/chat/respond.ts`), so the confirmation and
  the list are what gets posted. Each reminder gets a short number shown in both, which puts it in
  the channel history so "cancel that" can find it.
- **The model needs the current time.** Nothing in the prompt says what time it is, and messages
  carry no timestamps. Add the current date, time and the guild's time zone to the system prompt,
  for every reply (a few tokens, and it helps "what day is raid" questions too).
- **The command parses time itself**: durations (`2h`, `90m`, `1d 3h`) and plain clock times and
  days (`20:00`, `friday 19:30`, `tomorrow 8`), read in the guild's time zone. `chrono-node` does
  this, or a small parser for just those forms.
- **Storage and timing.** Reminders live in a git-ignored `config/reminders.json` so they survive
  deploys and restarts. A timer checks every 30 seconds. One that came due while Botty was offline
  is posted on startup, marked late. Fired reminders are removed.
- **Limits**: 10 active per member, at most a year ahead, text capped at Discord's message length.
  A member cancels their own, officers can cancel any.

Questions to settle first:
- Reminding someone else ("remind @member to bring flasks"): allowed with a ping, or only the asker
  and the channel?
- Repeating reminders (every Wednesday before raid). Easy to add to the same store, but it's a
  second feature: who can set them, and how they're seen and stopped.
- Channel post or DM. Channel is proposed: DMs can be turned off, and others see it too.
- The guild's time zone (realm server time is the likely choice), set as `timezone` in
  `config.json`.
- Whether the reminder is posted as written or reworded by Botty in his own voice when it fires.
  As written is proposed: predictable, free, and works when the model is down.

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

### Old context after a long pause

The history keeps at least 10 messages even across a long pause (`chat.history.minMessages`). On
2026-10-29 Botty fitted a newcomer's question into a group plan from two hours earlier. A limit on
how old those kept messages may be would fix it.

### Language

Botty answers in the language he's written to. Undecided whether that's wanted in a guild that
mostly talks in English.
