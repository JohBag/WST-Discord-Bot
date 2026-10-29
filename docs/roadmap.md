# Roadmap

What's built, what's parked and why. Newest first. This repo is public: describe situations, never
quote guild members or name them.

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

### Old context after a long pause

The history keeps at least 10 messages even across a long pause (`chat.history.minMessages`). On
2026-10-29 Botty fitted a newcomer's question into a group plan from two hours earlier. A limit on
how old those kept messages may be would fix it.

### Language

Botty answers in the language he's written to. Undecided whether that's wanted in a guild that
mostly talks in English.
