# Raid events and sign-ups

Design for raid and event sign-ups in Discord, for WoW retail and WoW Forever. Being built on the
`raid-signups` branch. Decisions are dated. This repo is public: describe situations, never quote
guild members or name them.

## Reference and success test

**Reference:** Raid-Helper (raid-helper.dev), the sign-up bot many WoW guilds use. Its post shows
the leader, date, time and a countdown, counts per role, then Tank, Healer, Melee and Ranged columns
with a class icon and sign-up number per person, and the Tentative and Absence lists underneath. Its
JSON export is what the Raid-Helper Helper addon imports to invite and sort the raid in game.

**Where this departs from it:** members save their characters once, so a sign-up is a character,
not a Discord name. Raid-Helper exports Discord display names, which the addon then needs a hand-kept
name table to turn into character names.

**Success test:** a raider signs up with one click and shows up in the right column with their class
icon. On raid night an officer pastes Botty's export into the addon and everyone gets an invite,
without fixing a single name.

## Decided (2026-11-15)

- Two games: WoW retail and WoW Forever. Each has its own classes, specs and roles (Forever has the 9
  vanilla classes with 3 specs each, and some specs fill two roles, like Feral and Enhancement).
- **Saved characters.** Members save their characters per game (name, realm for retail, class,
  spec) and mark a main. Signing up uses the main in one click, or picks an alt or another spec.
- **Statuses:** signed up, Late (stays in the roster with a mark), Tentative and Absent. Bench was
  in the first version and dropped on 2026-11-16, and "Absence" became "Absent". The addon skips
  Absent when inviting.
- **Officers only** create, edit, close and cancel events, with the same check as `/promote`.
- **Core:** creating events, the sign-up post, changing or withdrawing a sign-up, a Discord
  scheduled event (the server's Events tab) created and kept in step with the post, a JSON export in
  the addon's `signUps` format with real character names, editing, closing and cancelling.
- **Also in the first version:** reminders, repeating events, and a link to that night's Warcraft
  Logs post once Botty finds it.

- **The post:** one list per role (Tanks, Healers, DPS), each line a sign-up number, class
  icon, character and the member's Discord name when it isn't the character's name again. Late
  people stay in their role with a mark.
  Tentative and Absent underneath, with their count and names (the picked mockup showed
  counts only, names added in step 2 so officers can see who). Taller than Raid-Helper's columns,
  but reads the same on phones, where Discord stacks columns anyway.
- **Reminders:** one channel message an hour before start, pinging everyone signed up, Late or
  Tentative. No DMs.
- **Repeating events:** the guild raids twice a week (Wednesday and Sunday). Each raid's post goes
  up a week before it starts, so both upcoming raids are always open for sign-ups.
- **WoW Forever invites:** a small addon of our own that reads Botty's export, as a separate project
  after this one. Until then the export also gives a plain list of character names. Forever raids
  open 2026-12-09.

- **Raids and other events.** The officer picks raid or event when creating. An event post (guild
  meeting, M+ night) has one Attending list plus Tentative and Absent, and needs no characters. It
  gets the same calendar event and reminder.
- **Posts go where `/event create` is used** (2026-11-16, overturning "one channel per game, set
  in config"). A repeating raid posts each week where it was created.
- **Melee and ranged are one DPS role** (2026-11-16). The spec's own melee or ranged stays in the
  data for the addon export. Survival in Forever (melee or ranged) is then just DPS.
- **No role targets** (2026-11-16, overturning "role limits are targets"). Headings give the count
  only (Healers 2).
- **Off-specs.** A saved character can have an off-spec, shown as a small extra icon on its line.

## Build steps

1. **Class and spec data, and saving characters.** Built. `/characters` opens a private panel
   listing a member's characters per game, the main starred. Adding one is a class button, then a
   form with name, realm (retail only, filled in with the guild's realm, Aggramar, from
   `events.realm` in config), spec and off-spec (None by default). A form that's turned down shows why, with Try
   again to reopen it as it was filled in. Picking a character opens it with Edit, Make main and
   Remove (asks first). The first character in a game becomes the main, and removing the main hands
   it to the next. Up to 10 characters per game.
   - **Names and realms match what the addon accepts.** Names are capitalised the way the game does
     it. A retail realm is looked up in the EU realm list (`eu-realms.ts`, from the LibRealmInfo
     library the addon checks names against), however it was typed, and saved under its official
     name. A realm the addon wouldn't know is turned down rather than silently failing on raid
     night. Off-realm names are written the way the game does (`Name-DerRatvonDalaran`).
   - **WoW Forever characters have no realm.** Forever has no realms (2026-11-16), so its
     characters are a name only, in the panel and in the export.
   - **WoW Forever names have a first and a last name** (2026-11-17), each 2 to 12 letters like a
     retail name, and only the pair is unique, so both are required and saved as one name
     (`Thorvik Stonefist`). Retail names stay one word of up to 12 letters. Unverified: how the
     game's invite takes a two-part name, so the Forever export lists the full names as saved.
   - **A character can only be saved once.** If someone else holds it, the message names them.
     Officers can open any member's characters with `/characters member` to fix or free one.
2. **Creating an event, the sign-up post, answering, and edit, close and cancel.** Built.
   - **Creating:** `/event create game type` (officers only) opens a form: title, start and
     description. The start is typed in EU server time
     ("wed 19:30", "26/11 19:30", "tomorrow 20:00") and shown to everyone in their own time zone.
     The post goes in the channel where the command was used.
   - **The post:** title, description, start with a countdown and how many signed up (plain lines,
     no icons), then a section each for Tanks, Healers and DPS, each line a sign-up number, class
     icon, character, the off-spec's role as a small icon (only when it adds a role), "(late)" when
     late, and the member's server name. The footer names the game, the kind and the leader
     ("Retail raid led by ..."). Tentative and Absent are listed under it with names,
     since officers need to know who. Members are named in plain text, saved when they answer: a
     mention in a post can read as "unknown user" on phones and takes three times the room.
   - **Calmer post** (2026-11-18). No realm and no spec on the post: the class icon and the role
     heading say enough, and the addon export still carries both. The member's server name is left
     out when its first word is the character's name, or one is short for the other at 4 letters
     or more (Lath for Laththuzad, but Art still shows on Arthas), so it only shows for alts and
     other names. Numbers on the stacked lines are padded with non-breaking spaces to the widest
     one, so the class icons line up in one column. Unverified: that Discord keeps the padding.
   - **Room:** Discord allows 6000 characters per post. A full 40-player Forever raid with 15 more
     answers and the longest names (25 letters, 32 for server names) takes about 5200, or 5800 with
     a 600-letter description. Only the longest names with a 1000-letter description drop the
     server names (measured 2026-11-17). Should it ever run out, the
     member names go first, then the last lines of each list, replaced by "+N more". An event post
     is one Attending list plus Tentative and Absent.
   - **Answering:** a click only updates the post, with no private reply (2026-11-16). Sign up uses
     the main. **My sign-up** opens a private view with what they're signed up as and a menu to
     switch character, spec or role (or to sign up with another character). Only a click that needs
     an answer replies privately: a spec that fills two roles (Feral, Enhancement in Forever) asks
     which the first time, then remembers the role that character last signed up as, and with no
     character for that game the reply is the class picker, and they're signed up once it's saved.
     Late and Tentative work the same way, so officers see the class of everyone who might come.
     Changing status keeps the character. The number on each line is the order people answered,
     counting only who's on the post now, so officers can see who answered first. It stays through
     a change of status or spec. Withdrawing and coming back goes to the end (2026-11-16: a number
     that kept counting up after a withdraw read as a bug).
   - **After a restart** the bot draws the posts from the last week and ahead again, so a change to
     how posts look reaches the ones already up.
   - **Manage (officers):** Edit (the same form, filled in), Close or Open sign-ups, and Cancel
     event (asks first). A cancelled post stays, marked cancelled, without buttons. Sign-ups close
     by themselves at the start, once. An officer can open them again after. Moving the start later
     opens sign-ups again only if the start had closed them, not if an officer did.
3. **The Discord scheduled event.** Built. Each post gets an entry in the server's Events tab
   (title, description, start, end, and the sign-up post as its location link), where members click
   Interested. An edit updates it, and cancelling cancels it. Discord itself starts the entry at its
   start, which sends the notification to those interested, and completes it at its end: 2 hours
   for raids and events (`events.durationMinutes` in config, decided 2026-11-16). Botty asks Discord
   how the entry stands before each change instead of keeping its own copy. Moving a raid later
   after its entry went live ends that entry and makes a new one. At startup, upcoming events
   without an entry get one. Botty needs the Create Events permission (Manage Events on older
   servers). Without it the post still goes up and the officer is told.
   - **Interested signs up** (decided 2026-11-16). Clicking Interested on the entry signs the
     member up on the post with their main, as a full sign-up, if they hadn't answered yet: an
     answer already given stands. A two-role spec takes the role that character last signed up as,
     else its usual one, since there's no one to ask. Without a character for that game, they
     aren't signed up. Unclicking Interested withdraws a sign-up only if Interested made it and it
     hasn't been changed on the post since. Each time Botty sends the member a direct message
     saying what happened, with a link to the post, also when an answer they'd already given stands
     ("You're down as Absent"): a private reply in the channel only works as an answer to a click on
     Botty's own buttons. Clicks made while Botty was offline are caught up at startup, with the same
     messages, except "no character saved", which would otherwise come after every restart. A
     sign-up remembers which entry's Interested made it, so a replaced entry (moved raid, entry
     deleted by hand) withdraws no one. Bots can't mark anyone Interested, so a sign-up on the post
     doesn't tick Interested.
4. **The addon export.** Built. Manage has an Export button on raids (officers only). It opens a
   form with the JSON in a text box: Ctrl+A, Ctrl+C, then paste into /rhh in game (decided
   2026-11-16, over a file). It holds Signed up and Late, in answering order, and leaves Tentative
   and Absent out (decided 2026-11-16). Each entry is `Name-Realm` (spaces and hyphens removed from
   the realm), the addon's role (DPS split back into Melee or Ranged by spec) and Raid-Helper's spec
   name. The realm is always there, Aggramar too: an officer inviting from Hellscream (connected to
   Aggramar) would otherwise invite namesakes there. The addon drops it when it's the officer's own
   realm. No position: the addon takes the list order, five to a group, so more than 40 on the
   roster would spill into a group 9. A full 40-player raid takes about 3000 to 3700 of the box's
   4000 characters. Should one ever not fit, Export replies with a file instead.
   - **WoW Forever** raids export the names to invite, one per line, since the addon doesn't load
     there. Our own Forever addon is to read the full export later.
5. **Repeating events, reminders and the Warcraft Logs link.** Built.
   - **Repeating:** the create form has Repeat: Doesn't repeat or Every week, above the description
     so it's in sight without scrolling. A weekly series posts
     each week's raid a week before it starts, at the same server time (daylight saving doesn't
     move it), so the Wednesday and Sunday raids are both always open. Each week's post is its own.
     Edit on a week has Apply to: This event, or This and repeating events (decided 2026-11-16),
     which gives the later weeks, posted or not, the new title and description and moves them the
     way this week moved (same days, same new time). Earlier weeks stay. Manage on a week of a series has Stop repeating (asks first),
     which leaves the posts already up. A week counts as posted only once its post is up: a failed
     post is tried again each minute until its start, and a week with a post is never posted twice.
     Weeks whose start passed while Botty was offline are skipped. A series posts where it was
     created. The series are in the git-ignored
     `config/event-series.json`.
   - **Reminder:** `events.reminderMinutes` (60) before the start, a reply to the post pings
     everyone signed up, Late or Tentative ("**Mythic night** starts in an hour." and the pings).
     On by default: the create form has Reminder: Ping an hour before or No reminder, and Manage
     has Turn reminder off or on (decided 2026-11-16: officers, per event). On a repeating raid the
     switch goes for every week still to come.
     Once per event, and again after the start is moved. With nobody signed up it still goes out,
     without pings. None for a cancelled one or one posted after its reminder time. A big event's
     pings are split over several messages.
   - **Warcraft Logs link:** when the auto-post handles a raid night, the retail raid whose time it
     overlaps (give or take an hour) gets a "📜 Warcraft Logs" line linking that night's log. When
     two logs fall near one raid, the one covering more of it keeps the link. Not for Forever: its
     logs aren't on the site Botty reads.

## Defaults (not asked, change on request)

- A member's first Sign up click, with no character saved for that game, opens a private form to
  add one right there. A command lists, adds, edits and removes characters and sets the main.
- A spec that fills two roles in Forever (Feral, Enhancement) asks which role on sign-up.
- Sign-ups stay open until the start. Officers can still edit afterwards.
- Officers type times in the EU realms' server time (Central European). Every reader sees them in
  their own time zone.
- Class icons are uploaded to Botty's Discord application as emoji, not committed to the repo.

## The addon's import format

Raid-Helper Helper (retail addon) reads `signUps`, a list of entries with `name` (the character to
invite, `Name-Realm` when off-realm), `className` (really the role column: Tank, Healer, Melee,
Ranged, and Bench or Absence to skip), `specName` (Raid-Helper's spec names, with `Frost1`, `Holy1`
and `Protection1` for the second spec of that name) and `position`, the sign-up order that sets the
group and slot (5 per group). It invites everyone not yet in the raid every 30 seconds until all are
in.

The addon declares retail interface versions only, so it does not load in WoW Forever.

## Known issues

- **Changes made in the server's Events tab don't reach the post** (2026-11-17, left as is).
  Cancelling an entry there leaves the post open for sign-ups, and the startup pass makes a new
  entry for every upcoming post that isn't cancelled, so the cancelled one comes back on the next
  restart or edit. An edit there (time, title) is overwritten the next time the post changes.
  Cancel and edit events from the post's Manage panel. The fix, if wanted: listen for the entry
  being cancelled or deleted and cancel the post the same way Manage does.

## Not doing

- **Picking the roster and raid groups.** Left out of the first version (2026-11-15). The export
  orders people by sign-up, so the addon's groups follow that order.
- **A web view or comp tool** like Raid-Helper's. Everything decided fits Discord's own buttons,
  menus and forms: the post, private replies where a click needs an answer, My sign-up, and a form for saving a character.
  A web page earns its place for dragging people into the raid, bench and groups, which is left
  out. It would also need hosting, HTTPS and a Discord login. Revisit together with roster and
  groups.
- **Events created by any member.** Officers only.
