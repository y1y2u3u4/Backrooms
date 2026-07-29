/**
 * Notes — the written world.
 *
 * The Annex tells its story almost entirely on paper. There is no narrator, no
 * radio contact, no journal entry that summarises what you just learned. What
 * there is: carbon-copy maintenance dockets, a procedure that has been revised
 * until it contradicts itself, and one custodian who kept a private notebook he
 * was not supposed to keep.
 *
 * Rules these were written under:
 *
 *  1. **Nobody in the building is surprised.** The horror is that the paperwork
 *     kept up. A form that has a tick-box for "ROOM NOT IN SCHEDULE" is worse
 *     than a page of screaming.
 *  2. **The Surveyor is never named.** Meridian call it a discrepancy, an
 *     obstruction, plant. Only the custodian's notebook admits it walks.
 *  3. **Two documents that disagree are worth more than one that explains.**
 *     Procedure 7-C says to leave the lights on. Revision 4 says to kill them.
 *     The player works out which one was written by someone still alive.
 *  4. **One crack per document, at most.** These are professionals. The letter
 *     that never got sent is the only place anyone says how they feel, and even
 *     there it is mostly about the carpet.
 *
 * Anything with a `code` field is puzzle-load-bearing and must not be reworded
 * without checking `Interactables.js` / `Progression.js`.
 */

/** @typedef {{id:string,title:string,kind:string,zone:string,body:string,code?:string,tags?:string[]}} Note */

const N = (id, title, kind, zone, body, extra = {}) => ({ id, title, kind, zone, body: body.trim(), ...extra });

/** @type {Note[]} */
export const NOTES = [
  // ---------------------------------------------------------------- Intake --
  N('note_induction', 'Contractor Induction — Annex 7', 'form', 'intake', `
MERIDIAN FACILITIES MANAGEMENT
SITE INDUCTION — ANNEX 7 (NIGHT)

You have been issued: one lamp, one spare cell, one set of keys, one pager.
You have not been issued a floor plan. Floor plans for this site are held at
Area Office and are not to be brought on site.

Report to Room 7/G-004 at the start and end of every shift. If 7/G-004 is not
where you left it, report to the nearest room with a working kettle and log the
discrepancy on a 12/D.

Do not prop doors.
Do not work alone in the Cistern.
Do not attempt to correct the building.

Signed on behalf of the client — illegible
`),

  N('note_proc_7c', 'Procedure 7-C: Lighting During Night Occupation', 'procedure', 'intake', `
PROCEDURE 7-C (ORIGINAL ISSUE, MARCH 1991)

7-C.1  All circulation lighting shall remain energised for the duration of any
       night occupation.
7-C.2  Where a circuit has tripped, the operative shall reset it at the nearest
       distribution board before proceeding.
7-C.3  An operative shall not proceed along an unlit route.

This procedure exists because two men walked into a lift shaft in 1989. It is
not negotiable and it is not to be revised locally.

— J. Hallam, Contracts Manager
`),

  N('note_proc_7c_rev4', 'Procedure 7-C — Revision 4', 'procedure', 'intake', `
PROCEDURE 7-C REVISION 4 (NOVEMBER 1994)
SUPERSEDES ALL PREVIOUS ISSUES. DESTROY PREVIOUS ISSUES.

7-C.1  Circulation lighting shall be energised ONLY for the section the
       operative is presently occupying, and shall be de-energised behind him.
7-C.2  Where a circuit has tripped, the operative shall consider whether it has
       tripped for a reason.
7-C.3  An operative shall not proceed along a lit route he did not light.

7-C.9  This revision has not been approved by Area Office. It has been approved
       by the men on the night shift, who are the ones who have to walk it.

— unsigned
`, { tags: ['core'] }),

  N('note_tally', 'Tally Sheet — Doors', 'ledger', 'intake', `
DOORS CHECKED THIS SHIFT

Second floor east      ||||  ||||  ||||  |||
Second floor west      ||||  ||||  ||
Spine north            ||||  ||||  ||||  ||||  ||||  ||||  ||||  ||||
Spine south            ||||  ||||  ||||  ||||  ||||  ||||  ||||  ||||
                       ||||  ||||  ||||  ||||  ||||  ||||  ||||  ||||
                       ||||  ||||  ||||  ||||  ||||

Spine south is fourteen doors long.

I have stopped counting the spine.
`),

  N('note_drawing', 'A Child\'s Drawing', 'artefact', 'intake', `
Wax crayon on the back of a Meridian day-work sheet. Three figures in a yellow
corridor. Two are drawn in brown crayon, holding hands, with careful faces.

The third has no crayon on it at all. It is the shape of the paper showing
through where the yellow stops — a tall gap in the wall colour, narrower than a
person, with a square where a head would be. It reaches the top edge of the
page. The child has drawn the ceiling tiles in around it, so it must have been
drawn last.

On the reverse, in adult handwriting:
"Bring her Tuesdays instead. Nights are getting long."
`),

  N('note_lost_property', 'Lost Property Log', 'ledger', 'intake', `
LOST PROPERTY — RECEIVED AT 7/G-004

14/09  One donkey jacket, size L, name tape KEARNS
19/09  One spectacle case
02/10  One wedding band, engraved 'E.M. 1971'
02/10  One donkey jacket, size L, name tape KEARNS
11/10  One spectacle case
11/10  One wedding band, engraved 'E.M. 1971'
23/10  One donkey jacket, size L, name tape KEARNS

Kearns has been asked twice to collect. Kearns left the contract in August.
`),

  // -------------------------------------------------------- Service Spine --
  N('note_board_c', 'Distribution Board C — Schedule', 'schedule', 'spine', `
DISTRIBUTION BOARD C  (7/S-011)

WAY 1   INTAKE CIRCULATION          32A
WAY 2   INTAKE BAYS EAST            16A
WAY 3   INTAKE BAYS WEST            16A
WAY 4   SPINE STRIP LIGHTING        16A
WAY 5   CISTERN BULKHEADS           16A     ** WET LOCATION — ISOLATE FIRST **
WAY 6   RESIDENCE LANDING           10A
WAY 7   STACK LIFT LOBBY            16A
WAY 8   PLANT HIGH BAY              63A     ** NO SUPPLY — SEE FUSE ROOM **

Board C is fed from the Plant. If Way 8 is dead, everything downstream of the
Plant is on borrowed time and so are you.

DO NOT RUN MORE THAN THREE WAYS AT ONCE. The main is rated for a building that
is smaller than this one.
`, { tags: ['core'] }),

  N('note_daywork_1102', 'Day-Work Sheet 1102', 'form', 'spine', `
MERIDIAN — DAY-WORK SHEET  No. 1102

OPERATIVE:      D. KEARNS
LOCATION:       7/S-011 to 7/S-040
DESCRIPTION OF WORK:
    Traced spine strip lighting fault. Found no fault. Lighting was already
    energised on arrival. Way 4 was in the OFF position on arrival.

    Confirmed with meter. Way 4 off. Lights on.

MATERIALS USED:  none
TIME:            0140 — 0215
DISCREPANCY?     [X] YES   [ ] NO
If YES, complete form 12/D.

COUNTERSIGNED:   ___________________
`),

  N('note_12d_blank', 'Form 12/D — Discrepancy Report', 'form', 'spine', `
FORM 12/D — DISCREPANCY REPORT (BLANK)

ROOM REFERENCE:     7/____-______
NATURE OF DISCREPANCY (tick all that apply):

  [ ] Room not in schedule
  [ ] Room in schedule, not on site
  [ ] Room dimensions inconsistent with adjoining rooms
  [ ] Door leads to a room already entered by another door
  [ ] Corridor returns to its own start
  [ ] Services present with no origin
  [ ] Other (describe overleaf)

WAS THE OPERATIVE ALONE?        [ ] YES   [ ] NO
DID THE OPERATIVE HEAR PLANT RUNNING?   [ ] YES   [ ] NO
IF PLANT WAS HEARD, DID IT STOP WHEN THE OPERATIVE STOPPED?  [ ] YES  [ ] NO

Note: the last question was added at Revision 3 at the request of the night
shift. Area Office consider it unnecessary.
`),

  N('note_12d_filled', 'Form 12/D — Filed Copy (yellow)', 'form', 'spine', `
FORM 12/D — DISCREPANCY REPORT

ROOM REFERENCE:     7/S-036
NATURE OF DISCREPANCY:
  [X] Corridor returns to its own start
  [X] Services present with no origin
  [X] Other (describe overleaf)

WAS THE OPERATIVE ALONE?        [X] YES
DID THE OPERATIVE HEAR PLANT RUNNING?   [X] YES
IF PLANT WAS HEARD, DID IT STOP WHEN THE OPERATIVE STOPPED?  [X] YES

OVERLEAF:
It does not stop the way a motor stops. A motor runs down. This stops on the
beat, like a man who has been told to stand still, and then there is a sound
like a tape measure going back into its case.

I put the lights out and it did not start again.

OPERATIVE: D. KEARNS
`, { tags: ['core'] }),

  // ------------------------------------------------------------- Cistern --
  N('note_cistern_isolation', 'Cistern — Isolation Notice', 'notice', 'cistern', `
** ISOLATION NOTICE — DO NOT REMOVE **

The tank below this level is DRAINED DOWN for inspection.
Penstock 2 is CLOSED and PADLOCKED.
Penstock 1 is OPEN and must remain OPEN to relieve the header.

If both penstocks are found closed, the header will lift. If both are found
open, this floor will be under 700 mm of water within the hour.

There is no configuration in which you may leave and neither of them matter.

PERMIT No. 4471  —  EXPIRED 12/94
`, { tags: ['core'] }),

  N('note_wading', 'Handwritten, laminated, cable-tied to a handrail', 'note', 'cistern', `
WADING IS LOUD.

You cannot hear it over yourself. It cannot hear you over itself.
Whoever is quieter wins and it is never you.

Crouch in the shallow end and wait. It gets bored the way weather gets bored.
`),

  N('note_silt_log', 'Silt Depth Log', 'ledger', 'cistern', `
SILT DEPTH — SUMP 3      (mm, measured at the ladder)

JAN   40
FEB   45
MAR   50
APR   55
MAY   60
JUN   65
JUL   70
AUG   75
SEP   80
OCT   85
NOV   90
DEC   95

Twelve readings. Five millimetres a month, every month, no rain, no inflow, no
variation whatsoever. I have measured it wrong every single time for a year or
it is being added.
`),

  // ----------------------------------------------------------- Residence --
  N('note_residence_rooms', 'Room Allocation — Second Landing', 'schedule', 'residence', `
STAFF ACCOMMODATION — SECOND LANDING
(disused; retained for night-shift rest periods)

7/R-201   KEARNS, D.        night
7/R-202   —
7/R-203   OKONJO, A.        night
7/R-204   —
7/R-205   —
7/R-206   —
7/R-207   —
7/R-208   HALLAM, J.        days (does not sleep on site)
7/R-209   —
7/R-210   —
7/R-211   —
7/R-212   KEARNS, D.        night

Kearns is allocated two rooms because he could not find the first one twice
running and it was easier to allocate a second than to argue.
`),

  N('note_letter', 'A Letter, Not Sent', 'letter', 'residence', `
Ellen,

The carpet up here is the same as the carpet at home, which I did not expect.
Same loop, same colour, a bit damper. I keep putting my foot down and getting
our hallway. It is a stupid thing to write to you about.

I am fine. The money is good and Hallam has put me on nights until the new year
so we will have it cleared by spring.

I have been keeping a notebook, which we are not meant to. Not about anything.
Just what I do and when I do it and which way I turned. It helps to be able to
look back and see that I did turn left, because there are nights when the
building is very sure I did not.

Do not come to the open day. I know I said. Do not bring her either.

I will telephone Sunday.

Yours always,
Dennis
`, { tags: ['core'] }),

  N('note_open_day', 'Meridian Family Open Day — Poster', 'poster', 'residence', `
MERIDIAN FACILITIES MANAGEMENT
FAMILY OPEN DAY

SATURDAY 3 DECEMBER  —  ANNEX 7  —  10:00 to 15:00

  * See where we work!
  * Refreshments in the Records Bay
  * Children must be accompanied AT ALL TIMES
  * Children must be accompanied AT ALL TIMES
  * Children must be accompanied AT ALL TIMES

Please sign your party in and, importantly, out.

(Somebody has gone over the third line in biro, several times, hard enough to
tear the paper.)
`),

  N('note_keycard_memo', 'Memo: Card Access, Second Landing', 'memo', 'residence', `
INTERNAL MEMO

FROM:  Area Office
TO:    All operatives, Annex 7
RE:    Card access, Residence landings

Card readers on the Residence landings have been re-programmed. Cards issued
before October will NOT open R-207.

R-207 holds the spare fuse cores. If you need one and your card is old, the
warden's card is on the warden's belt and the warden is where he always is.

We are aware that this is not an acceptable answer. Area Office are looking at
it.
`, { tags: ['core'] }),

  // --------------------------------------------------------------- Stack --
  N('note_stack_survey', 'Structural Survey — Note of Concern', 'report', 'stack', `
EXTRACT — STRUCTURAL SURVEY, ANNEX 7, 1993

"...the vertical circulation core (drawing ref. S/7/14) is shown on the 1971
drawings as serving eight floors. On site the core serves eight floors above
the entrance level and eight floors below it, with identical finishes,
identical signage and identical room numbering on every floor.

The lower eight are not shown on any drawing in our possession. They are
finished to the same specification and the same standard of workmanship. The
door furniture is from the same batch.

We are unable to offer an opinion on the load path and decline to certify."
`),

  N('note_lift_permit', 'Goods Lift — Permit to Operate', 'notice', 'stack', `
GOODS LIFT No. 2  —  PERMIT TO OPERATE

SAFE WORKING LOAD          750 kg
POWER                      THREE PHASE — from Plant only
CONDITION OF OPERATION     All three supply cores fitted and healthy.

The lift will accept a call with one core fitted. It will accept a call with
two. It will travel with three and only three, and it will travel exactly once
before the interlock resets.

Do not send the car away empty to test it. Every man on this contract has done
it once and every man on this contract has then walked.
`, { tags: ['core'] }),

  N('note_floor_indicator', 'Sticker on the lift lobby glass', 'note', 'stack', `
The floor indicator counts UP as the car goes DOWN.

This was reported as a fault in 1991, attended twice, and closed as
"working as installed".
`),

  // --------------------------------------------------------------- Plant --
  N('note_generator_start', 'Set No. 2 — Starting Procedure', 'procedure', 'plant', `
STARTING PROCEDURE — STANDBY SET No. 2

BEFORE STARTING, CONFIRM ALL THREE SUPPLY CORES FITTED AND LATCHED.

  1.  FUEL VALVE — open. Wait for the sight glass to clear. It will knock.
  2.  PRIMER — pump until firm. Twelve strokes cold, six warm. If it never
      goes firm, the day tank is empty and nothing you do at the panel will
      change that.
  3.  STARTER — hold. Do not hold longer than fifteen seconds. If she does not
      catch, let the motor cool for a full minute or you will burn it out and
      then you are here until somebody comes, and nobody comes.

AFTER STARTING: stand clear of the flywheel guard. The guard is missing.

The set is very loud. Everything in this building that listens will know where
you are. Have your route out worked out before you press anything.
`, { tags: ['core'] }),

  N('note_fuse_room', 'Fuse Room — Stock Card', 'ledger', 'plant', `
STOCK CARD — HRC SUPPLY CORES, 400A

OPENING STOCK (JAN)              6
ISSUED  — Cistern penstock room  1
ISSUED  — Residence R-207 store  1
ISSUED  — Stack lift lobby       1
DAMAGED — dropped, Plant floor   1
RETURNED                         0

CLOSING STOCK                    2
PHYSICAL COUNT                   0

The two remaining cores are not in this room and were not taken out of it.
Whoever is doing the count next month: do not sign it. I signed it. Do not
sign it.
`, { tags: ['core'] }),

  N('note_transformer', 'Handwritten on the transformer housing, in chalk', 'note', 'plant', `
IF IT WHINES AND THE PLANT IS DOWN

IT IS NOT THE PLANT
`),

  // ------------------------------------------------ Kearns' notebook --
  N('nb_1', 'Notebook — first page', 'notebook', 'any', `
D. KEARNS. PRIVATE. NOT A MERIDIAN RECORD.

I am writing this because the forms only have boxes for things Area Office have
already thought of.

Rules so far, in order of how much they have cost me:

1.  It moves when there is light on it. Under a good fluorescent it walks at
    about the pace of a man who is not in a hurry. In the dark it does not
    move at all. Not slowly. At all.
2.  It cannot see. I have stood at arm's length from it with my lamp off and it
    went past me and put its hand on the wall behind me.
3.  It hears. Water, doors, boots, anything dropped. It goes to the sound in a
    straight line and it commits to it, and if you are quiet from then on it
    goes to where the sound was and not to where you are.
`, { tags: ['core', 'notebook'] }),

  N('nb_2', 'Notebook — the lamp', 'notebook', 'any', `
The lamp is the whole problem.

Your hand wants the light on it. Every part of you wants the light on it. Put
the light on it and you have fed it. I have watched it stop dead halfway
through a stride because a tube went out, and stand there for eleven minutes
with one foot off the floor, and start again the instant I turned my lamp on to
see whether it had gone.

Cover the lens with your palm. Do not switch off — the switch clicks and it
hears the click. Cover it.
`, { tags: ['core', 'notebook'] }),

  N('nb_3', 'Notebook — measuring', 'notebook', 'any', `
When it loses you it measures.

It stops, it puts an arm flat against the wall, and it holds there. Four
seconds, nine seconds, I have not seen longer than nine. It is taking the
building's dimensions. It does this constantly and it has been doing it for
longer than I have been alive, I think, and I do not believe it has ever got an
answer it liked, because it always measures the same wall again.

That is your window. Not the darkness — the darkness only freezes it. The
measuring is when it is not looking for you at all.

Walk. Do not run. Running is a sound.
`, { tags: ['core', 'notebook'] }),

  N('nb_4', 'Notebook — the other one', 'notebook', 'any', `
There is a second one and it has no shape.

It has never been in a room with me. It only ever gets in front of me. A chair
turned to face a door I had not opened yet. My locker shut, that I left open,
with my sandwiches still on top of it where I put them to open it. Footprints
in the silt starting in the middle of the floor, going to the door, dry the
whole way.

Last week: a 12/D, filled in, in my hand, in my writing, for a room I have not
been in. Signed. Countersigned by Hallam, who has not been on site since
August.

I am not frightened of that one. I do not know what that says about me.
`, { tags: ['core', 'notebook'] }),

  N('nb_5', 'Notebook — last page', 'notebook', 'any', `
Way 8 is the whole thing. Get the Plant lit and the building runs out of dark
places to keep it in, and the lift will take you out.

Three cores. One in the Cistern behind the penstocks, which means you flood a
floor or you drain one and either way it hears you. One in R-207, and my card
is old, so it will have to be the warden's. One in the Stack, and the Stack is
not a place, so take the lift and do not look at the indicator.

E — if it is you reading this, and it should not be, the authorisation on the
terminal in the Office of Record is not a number anybody could guess. It is the
date on the open-day poster, written as four figures, and then reversed. I set
it. I am sorry about the open day.

Do not come and look for me. I am fine. I am simply not finished.
`, { tags: ['core', 'notebook'], code: '2130' }),

  // ---------------------------------------------------------- discovery --
  N('note_office_of_record', 'Office of Record — Card on the desk', 'note', 'safe', `
THE KETTLE WORKS.

That is not a joke and it is not a trap. Somebody keeps it filled. The tea is
in the tin marked SUGAR because the tin marked TEA does not open.

You may sit down. Nothing has ever come in here.

Nothing has ever come in here yet, is what I should write, but I am tired and I
would like one room in this building where I am allowed to write the short
version.
`),

  N('note_ending_hint', 'Docket 0000 — undated, uncreased', 'form', 'any', `
MERIDIAN — DAY-WORK SHEET  No. 0000

OPERATIVE:      (your name, printed, correctly, in a hand you do not recognise)
LOCATION:       7/P-001 GENERATOR HALL
DESCRIPTION OF WORK:
    Attended. Restored supply. Did not leave.

TIME:           ____ — ————
DISCREPANCY?    [ ] YES   [ ] NO

Note in the margin, very small:
"The lift is one way and the building knows it. If you would rather it did not
have to keep making rooms for you, there is a way to leave the set running and
not get in the car. Nobody has taken it. It is on the docket if you want it."
`, { tags: ['ending'] }),
];

// ---------------------------------------------------------------------------
// Tape transcripts. The audio agent voices and processes these; timings are
// cues, not gospel — `t` is seconds from the head of the tape.
// `processing` describes the tape's physical condition, which is a performance
// note as much as a DSP note.
// ---------------------------------------------------------------------------

export const TAPES = [
  {
    id: 'tape_induction',
    title: 'Tape 1 — Site Induction (side A)',
    zone: 'intake',
    duration: 62,
    processing: 'Reel-to-reel dubbed to cassette. Clean, boxy, a room with a hard ceiling. Mains hum at 50 Hz throughout.',
    lines: [
      { t: 0.0, speaker: 'HALLAM', text: 'Testing. One, two. Right.' },
      { t: 3.5, speaker: 'HALLAM', text: 'This is the induction tape for Annex 7 night operations, recorded the ninth of March.' },
      { t: 10.0, speaker: 'HALLAM', text: 'You will have been given a lamp, a spare cell, and keys. You will not have been given a plan. That is deliberate.' },
      { t: 19.0, speaker: 'HALLAM', text: 'A plan of this building is worse than no plan. A man with no plan looks where he is going.' },
      { t: 26.5, speaker: 'HALLAM', text: 'Lighting stays on. That is procedure 7-C and it is the only one I will ask you to learn by heart.' },
      { t: 34.0, speaker: 'HALLAM', text: 'If you find a room that is not on the schedule, you do not go in, you log it, and you carry on with your round.' },
      { t: 43.0, speaker: 'HALLAM', text: 'Somebody at Area Office reads the logs. I have not met them.' },
      { t: 49.0, speaker: 'HALLAM', text: '[pause, chair]' },
      { t: 52.0, speaker: 'HALLAM', text: 'That will do. Stop it there, Dennis.' },
      { t: 55.5, speaker: 'KEARNS', text: '[distant, off-mic] It is still running.' },
      { t: 58.0, speaker: 'HALLAM', text: 'Then stop it.' },
    ],
  },

  {
    id: 'tape_kearns_1',
    title: 'Tape 2 — "For the record" (Kearns)',
    zone: 'spine',
    duration: 74,
    processing: 'Recorded on a pocket dictaphone held too close. Breath on the capsule, clipping on plosives. Corridor slap-back, long. Footsteps stop and start.',
    lines: [
      { t: 0.0, speaker: 'KEARNS', text: 'Right. For the record, because the forms have not got a box for it.' },
      { t: 6.0, speaker: 'KEARNS', text: 'It is twenty past two. I am in the south spine, about level with S-036.' },
      { t: 13.0, speaker: 'KEARNS', text: '[footsteps, six paces, stop]' },
      { t: 18.0, speaker: 'KEARNS', text: 'It is doing the thing. Listen.' },
      { t: 22.0, speaker: '—', text: '[silence. Faint rising tone, barely present, three seconds, then nothing]' },
      { t: 30.0, speaker: 'KEARNS', text: 'You will not have got that. It does not go onto tape properly, I have tried four times.' },
      { t: 37.0, speaker: 'KEARNS', text: 'It is like a transformer coming up to load. You feel it in your fillings before your ears have it.' },
      { t: 45.0, speaker: 'KEARNS', text: 'Three seconds, four at the outside, and then it is at the end of the corridor.' },
      { t: 52.0, speaker: 'KEARNS', text: 'Not walking up it. At the end of it.' },
      { t: 57.0, speaker: 'KEARNS', text: '[footsteps resume, faster, then a click — lamp switch]' },
      { t: 63.0, speaker: 'KEARNS', text: '[whisper] Do not switch off. Cover it. I keep— cover it, Dennis.' },
      { t: 70.0, speaker: '—', text: '[tape ends abruptly, no run-out]' },
    ],
  },

  {
    id: 'tape_cistern',
    title: 'Tape 3 — Penstock Handover',
    zone: 'cistern',
    duration: 58,
    processing: 'Recorded in a hard wet volume. Enormous decay, 4-5 s, low-passed. Water movement under everything. Voice is shouting to be heard and still sounds small.',
    lines: [
      { t: 0.0, speaker: 'OKONJO', text: 'Handover, Cistern, Tuesday night, Okonjo to whoever has got the Wednesday.' },
      { t: 7.0, speaker: 'OKONJO', text: 'Penstock 2 is padlocked shut and the key is on the board at G-004, do not go looking for it down here.' },
      { t: 15.0, speaker: 'OKONJO', text: 'Penstock 1 is open. Leave it open.' },
      { t: 19.5, speaker: 'OKONJO', text: '[water, a long slop against steel]' },
      { t: 24.0, speaker: 'OKONJO', text: 'I know what the notice says. I know it says you cannot leave. You can leave. You just have to be quick and you have to be quiet and you cannot be both.' },
      { t: 35.0, speaker: 'OKONJO', text: 'So be quick, and get up the ladder, and then be quiet for a long time.' },
      { t: 42.0, speaker: 'OKONJO', text: 'It came down the ladder after me once. It does not like the ladder. It has too many arms for a ladder.' },
      { t: 50.0, speaker: 'OKONJO', text: 'That is the handover. God bless.' },
    ],
  },

  {
    id: 'tape_residence',
    title: 'Tape 4 — Answering Machine, R-201',
    zone: 'residence',
    duration: 47,
    processing: 'Micro-cassette answerphone. Bandlimited 300 Hz to 3.4 kHz, telephone line noise, mechanical beep before each message. Room is small, soft, carpeted.',
    lines: [
      { t: 0.0, speaker: 'MACHINE', text: '[beep] You have three messages.' },
      { t: 4.0, speaker: 'MACHINE', text: '[beep] Message one, received Sunday, nine forty-one.' },
      { t: 8.0, speaker: 'ELLEN', text: 'It is me. You said Sunday. It is Sunday. Ring me.' },
      { t: 14.0, speaker: 'MACHINE', text: '[beep] Message two, received Sunday, eleven fifty-two.' },
      { t: 18.5, speaker: 'ELLEN', text: 'Dennis. The man at the Area Office says you have not signed out since the third. He says that is not unusual.' },
      { t: 27.0, speaker: 'ELLEN', text: 'He said it in a way I did not like. Ring me.' },
      { t: 32.0, speaker: 'MACHINE', text: '[beep] Message three, received today, two eighteen.' },
      { t: 37.0, speaker: '—', text: '[line noise. A room tone that is not a telephone room tone. Then, quite close to the mouthpiece, a slow tick — three notches, like a dial being turned. Then the line clears.]' },
      { t: 45.0, speaker: 'MACHINE', text: '[beep] End of messages.' },
    ],
  },

  {
    id: 'tape_plant',
    title: 'Tape 5 — Set No. 2, Commissioning',
    zone: 'plant',
    duration: 68,
    processing: 'Industrial. Huge room, 6 s decay, mid-forward. Engineer close-miked, second voice fifteen metres away and unintelligible on words. Diesel start at 41 s must be genuinely startling.',
    lines: [
      { t: 0.0, speaker: 'ENGINEER', text: 'Set two, commissioning run, cold start, first attempt.' },
      { t: 6.0, speaker: 'ENGINEER', text: 'Cores are in. All three latched. Fuel valve — open.' },
      { t: 12.0, speaker: '—', text: '[a long metallic knock, then a settling hiss]' },
      { t: 18.0, speaker: 'ENGINEER', text: 'She knocks. She always knocks. Priming.' },
      { t: 23.0, speaker: '—', text: '[twelve pump strokes, slowing, going stiff]' },
      { t: 34.0, speaker: 'ENGINEER', text: 'Firm. Standing clear. Starter.' },
      { t: 38.0, speaker: '—', text: '[starter motor, four seconds of dry crank]' },
      { t: 42.5, speaker: '—', text: '[catch — enormous. The room becomes a different room]' },
      { t: 48.0, speaker: 'ENGINEER', text: '[shouting] Guard is off! GUARD IS OFF, GET BACK!' },
      { t: 53.0, speaker: 'SECOND VOICE', text: '[distant, indistinct, calm]' },
      { t: 58.0, speaker: 'ENGINEER', text: 'Who is that? Who is on the gantry?' },
      { t: 63.0, speaker: 'ENGINEER', text: '[quieter, to himself] There is nobody on the gantry.' },
    ],
  },

  {
    id: 'tape_last',
    title: 'Tape 6 — untitled, unlabelled',
    zone: 'any',
    duration: 55,
    processing: 'A tape that has been recorded over. The induction tape bleeds through underneath — Hallam, backwards and slowed, just at the edge of intelligibility. The new recording is very quiet and very close.',
    lines: [
      { t: 0.0, speaker: 'KEARNS', text: '[whisper] I have worked out what it is measuring.' },
      { t: 6.0, speaker: 'KEARNS', text: 'It is not the building. The building is fine. The building is a 1971 office block with four bad extensions and I could survey it in a week.' },
      { t: 16.0, speaker: 'KEARNS', text: 'It is measuring the gap.' },
      { t: 20.0, speaker: 'KEARNS', text: 'Between what is on the drawings and what is on site. And every time it takes a reading, the gap has got bigger, because it has had to make somewhere to stand while it took the last one.' },
      { t: 34.0, speaker: 'KEARNS', text: 'It is not haunting the building. It is surveying it. Badly. Forever.' },
      { t: 42.0, speaker: 'KEARNS', text: 'And we have been logging the discrepancies on carbon paper for three years like that is a help.' },
      { t: 50.0, speaker: 'KEARNS', text: '[a long breath] Right. Way 8.' },
    ],
  },
];

// ---------------------------------------------------------------------------

const byId = new Map();
for (const n of NOTES) byId.set(n.id, n);
for (const t of TAPES) byId.set(t.id, t);

/**
 * NotesLibrary — lookup, read-tracking and the journal's data source.
 *
 * Reading a note is a *state change*, not just a UI event: several puzzles gate
 * on the player having actually read the document that carries the code, so
 * that nobody can brute-force a keypad they were never told about.
 */
export class NotesLibrary {
  constructor(bus = null) {
    this.bus = bus;
    this.read = new Set();
    this.collected = new Set();
    this.order = [];
  }

  get(id) { return byId.get(id) || null; }
  all() { return NOTES; }
  tapes() { return TAPES; }

  /** Everything the player has picked up, newest first — the journal's list. */
  journal() {
    return this.order.slice().reverse().map((id) => byId.get(id)).filter(Boolean);
  }

  has(id) { return this.collected.has(id); }
  hasRead(id) { return this.read.has(id); }

  /** Called when a note prop is picked up or a terminal page is opened. */
  collect(id) {
    const n = byId.get(id);
    if (!n) { console.warn(`[notes] unknown id "${id}"`); return null; }
    if (!this.collected.has(id)) {
      this.collected.add(id);
      this.order.push(id);
    }
    return n;
  }

  /** Collect + open. Emits `story:note` for the UI to render the page. */
  open(id) {
    const n = this.collect(id);
    if (!n) return null;
    this.read.add(id);
    if (n.lines) {
      this.bus?.emit('story:tape', { id, title: n.title, lines: n.lines, duration: n.duration, processing: n.processing });
    } else {
      this.bus?.emit('story:note', { id, title: n.title, body: n.body, kind: n.kind });
    }
    return n;
  }

  /** Notes tagged `core` are the ones the pacing director counts as progress. */
  coreReadCount() {
    let n = 0;
    for (const id of this.read) if (byId.get(id)?.tags?.includes('core')) n++;
    return n;
  }

  stats() {
    return {
      total: NOTES.length + TAPES.length,
      collected: this.collected.size,
      read: this.read.size,
      core: this.coreReadCount(),
    };
  }
}

export default NotesLibrary;
