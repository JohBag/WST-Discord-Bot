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
- **Statuses:** signed up, Tentative, Late (stays in the roster with a mark), Bench (willing to sit
  out) and Absence. The addon skips Bench and Absence when inviting.
- **Officers only** create, edit, close and cancel events, with the same check as `/promote`.
- **Core:** creating events, the sign-up post, changing or withdrawing a sign-up, a Discord
  scheduled event (the server's Events tab) created and kept in step with the post, a JSON export in
  the addon's `signUps` format with real character names, editing, closing and cancelling.
- **Also in the first version:** reminders, repeating events, and a link to that night's Warcraft
  Logs post once Botty finds it.

- **The post:** one list per role (Tanks, Healers, Melee, Ranged), each line a class icon, sign-up
  number, character, spec and the member's Discord name. Late people stay in their role with a mark.
  Counts for Tentative, Late, Bench and Absence underneath. Taller than Raid-Helper's columns, but
  reads the same on phones, where Discord stacks columns anyway.
- **Reminders:** one channel message an hour before start, pinging everyone signed up, Late or
  Tentative. No DMs.
- **Repeating events:** the guild raids twice a week (Wednesday and Sunday). Each raid's post goes
  up a week before it starts, so both upcoming raids are always open for sign-ups.
- **WoW Forever invites:** a small addon of our own that reads Botty's export, as a separate project
  after this one. Until then the export also gives a plain list of character names. Forever raids
  open 2026-12-09.

- **Raids and other events.** The officer picks raid or event when creating. An event post (guild
  meeting, M+ night) has one Attending list plus Tentative and Absence, and needs no characters. It
  gets the same calendar event and reminder.
- **One channel per game**, set in config.
- **Role limits are targets, not caps.** A raid can set how many tanks and healers it wants. A full
  role still takes sign-ups and its header shows the overflow (Tanks 3/2). Officers sort it out.
- **Off-specs.** A saved character can have an off-spec, shown as a small extra icon on its line.

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

## Not doing

- **Picking the roster and raid groups.** Left out of the first version (2026-11-15). The export
  orders people by sign-up, so the addon's groups follow that order.
- **A web view or comp tool** like Raid-Helper's. Everything decided fits Discord's own buttons,
  menus and forms: the post, private replies to each click, and a form for saving a character.
  A web page earns its place for dragging people into the raid, bench and groups, which is left
  out. It would also need hosting, HTTPS and a Discord login. Revisit together with roster and
  groups.
- **Events created by any member.** Officers only.
