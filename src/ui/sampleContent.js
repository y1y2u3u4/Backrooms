/**
 * Sample journal content.
 *
 * Used by the UI harness so every screen can be inspected before the game has
 * any real content, and available to the integrator as a formatting reference —
 * the shape of these objects is the shape `ui.addNote` / `ui.addTape` expect.
 *
 * The writing is here rather than in the harness because it is easier to keep
 * the tone consistent when it all sits in one file: everything is somebody
 * doing their job, in the register of the form they were given.
 */

export const SAMPLE_NOTES = [
  {
    id: 'note.disc.04',
    ref: '7/L-112',
    date: '11.02.94',
    kind: 'Discrepancy log',
    title: 'Sheet 4 — lower ground corridor',
    stamp: 'Noted',
    stampSub: 'NO ACTION',
    sign: 'R. Hale',
    body: `Corridor L-112 measured at 41.8 m on 09.02. Measured again this shift at 47.0 m. Same tape, same two marks on the skirting, both marks still present and 41.8 m apart on the tape.

I have written both figures down. I am not putting either of them in the box marked CORRECTED because I do not know which one is the correction.

Carpet joins are wrong at the north end. The pattern runs across the corridor for the last four metres and along it everywhere else. There is no join. I have checked with a knife.`,
  },
  {
    id: 'note.proc.rev11',
    ref: '7/PR-011',
    date: '—',
    kind: 'Procedure',
    title: 'Revised night procedure, rev. 11',
    stamp: 'Issued',
    stampSub: 'MERIDIAN FM',
    body: `1. Attend site. Sign the book at the gate whether or not there is anybody at the gate.

2. Do not use the goods lift while the supply is faulted. The car will still come.

3. Log every discrepancy on the sheet provided. A discrepancy is any difference between the building and the schedule. It is not necessary to determine which of the two is wrong.

4. If a room is not where the schedule says it is, do not look for it. Continue the round and log it at the end.

5. Lighting circuits are to be left as found. Custodians have reported that switching a circuit off in one part of the building switches something on in another. This has been investigated and no fault was found.

6. Do not assist the survey.`,
  },
  {
    id: 'note.attendant',
    ref: '7/L-140',
    date: '—',
    kind: 'Found on a chair',
    title: 'Untitled — pencil, back of a form',
    stamp: 'Unfiled',
    sign: '—',
    body: `it turns the chairs round. thats all it does that i can prove. i come in and the chair is facing the door and i know i left it under the desk because i put it under the desk.

second week i started marking them. chalk on the back leg. same chairs. same chalk.

im not frightened of the chair.`,
  },
  {
    id: 'note.plant.fuse',
    ref: '7/PL-003',
    date: '28.01.94',
    kind: 'Works order',
    title: 'Goods lift — three-phase supply',
    stamp: 'Outstanding',
    stampSub: 'PART 1 OF 3',
    sign: 'D. Ansell',
    body: `Supply to the goods lift has dropped a phase. Three fuse cores required, type HRC 63 A, from the distribution boards at Intake, the Cistern pump room and the Residence riser.

Cores were removed at some point between the last inspection and this one. The boards were not forced. The cabinet keys are on the board in the office and have not moved.

Do not attempt to bridge the supply. The lift is rated for four thousand kilos and it will lift whatever is in it.`,
  },
  {
    id: 'note.own.name',
    ref: '7/L-201',
    date: '—',
    kind: 'Discrepancy log',
    title: 'Sheet 1 — blank',
    stamp: 'Received',
    stampSub: 'THIS SHIFT',
    body: `This is a blank sheet from the pad in the Office of Record.

The contractor name box has been filled in.

It is your name. You have not filled in a sheet tonight.`,
  },
];

export const SAMPLE_TAPES = [
  {
    id: 'tape.01',
    ref: 'C-90 / 01',
    title: 'Night round, 03.02.94',
    duration: 154,
    transcript: [
      { at: 0, who: 'Hale', text: 'Round one. Zero two forty. Starting at Intake, working the spine.' },
      { at: 14, who: 'Hale', text: 'Fluorescents are up in the whole of L one-twelve, which they should not be, because I put that circuit off at the board an hour ago.' },
      { at: 33, who: '', text: '[ ballast hum, close ]' },
      { at: 41, who: 'Hale', text: 'I am going to leave it. Procedure says leave circuits as found. I did not find them like this but I am leaving them.' },
      { at: 63, who: '', text: '[ footsteps stop ]' },
      { at: 70, who: 'Hale', text: 'There is a chair in the middle of the corridor.' },
      { at: 79, who: 'Hale', text: 'Facing me.' },
      { at: 96, who: 'Hale', text: 'Right. Logged. Continuing.' },
      { at: 118, who: '', text: '[ a low rising whine, distant ]' },
      { at: 131, who: 'Hale', text: 'That is the transformer in the plant room. That is four floors from here.' },
      { at: 145, who: '', text: '[ recording ends ]' },
    ],
  },
  {
    id: 'tape.02',
    ref: 'C-90 / 02',
    title: 'Interview — D. Ansell, contracts',
    duration: 121,
    transcript: [
      { at: 0, who: 'Ansell', text: 'We did not close the building. I want that understood. Nobody made a decision to keep it open, either. There was simply never a meeting at which it was closed.' },
      { at: 22, who: 'Interviewer', text: 'And the night staff?' },
      { at: 27, who: 'Ansell', text: 'The night staff kept attending, and we kept paying them, because the contract said we pay them for attendance and they were attending.' },
      { at: 48, who: 'Ansell', text: 'The procedure got longer. That is all that happened. Every discrepancy generated a revision and every revision generated a discrepancy.' },
      { at: 72, who: 'Interviewer', text: 'Rev. eleven is the last one.' },
      { at: 77, who: 'Ansell', text: 'Rev. eleven is the last one we printed.' },
      { at: 92, who: '', text: '[ long pause ]' },
      { at: 101, who: 'Ansell', text: 'You should not go down there with a lamp. Take one, but do not put it on. It is not the dark that finds you.' },
    ],
  },
  {
    id: 'tape.03',
    ref: 'C-90 / 03',
    title: 'Dictaphone — unlabelled',
    duration: 78,
    transcript: [
      { at: 0, who: '', text: '[ tape hiss ]' },
      { at: 9, who: '', text: '[ water, knee deep, close ]' },
      { at: 21, who: '?', text: 'Two seventy. Two seventy. Two seventy-one.' },
      { at: 34, who: '', text: '[ a flat metal edge drawn along a wall ]' },
      { at: 47, who: '?', text: 'Two seventy-one.' },
      { at: 58, who: '', text: '[ the water stops moving ]' },
      { at: 69, who: '', text: '[ recording ends ]' },
    ],
  },
];

/** A partial survey — enough to show what a half-explored plan looks like. */
export const SAMPLE_PLAN = {
  nodes: [
    { id: 'lift', x: 0, z: 0, label: 'goods lift', kind: 'lift' },
    { id: 'l112a', x: 0, z: -8.4, label: '', kind: 'junction' },
    { id: 'l112b', x: 0, z: -21, label: '7/L-112', kind: 'junction' },
    { id: 'intake1', x: -12.6, z: -21, label: 'intake', kind: 'room' },
    { id: 'intake2', x: -12.6, z: -33.6, label: '7/L-118', kind: 'room' },
    { id: 'spine', x: 12.6, z: -21, label: 'spine', kind: 'junction' },
    { id: 'spine2', x: 25.2, z: -21, label: '', kind: 'junction' },
    { id: 'board', x: 25.2, z: -8.4, label: 'board A', kind: 'room' },
    { id: 'stair', x: 25.2, z: -33.6, label: 'stair down', kind: 'junction' },
    { id: 'cistern', x: 33.6, z: -42, label: 'water', kind: 'room' },
    { id: 'office', x: -12.6, z: -8.4, label: 'office of record', kind: 'room' },
  ],
  edges: [
    ['lift', 'l112a'], ['l112a', 'l112b'], ['l112b', 'intake1'], ['intake1', 'intake2'],
    ['l112b', 'spine'], ['spine', 'spine2'], ['spine2', 'board'], ['spine2', 'stair'],
    ['stair', 'cistern'], ['l112a', 'office'],
  ],
  here: { x: 12.6, z: -21 },
};

export default { SAMPLE_NOTES, SAMPLE_TAPES, SAMPLE_PLAN };
