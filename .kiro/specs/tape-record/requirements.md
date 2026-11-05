# tape-record — requirements (2026-11-05, from script/notes/物件×房间.md)

The walkman records at the bedside at night: 「夜里按录音放枕边；白天倒着放」. The other half of objects-in-room for the tape.

## R1. Recording
- The walkman's drawn device gets a `rec` key (a red dot, left of play). It works only at 床 at night (after the shutdown beat, before lying down), the objects-in-room way (`works` rule for the `rec` key only: `at: [bed]`, night); elsewhere it shows the line `obj.works.recNight` and does nothing.
- Pressing `rec` there logs `{ kind: "record", day }` once per night; the walkman shows the reels turning slowly until the player lies down. An upgraded walkman cannot record (Kuro transcribes instead; nothing to find).

## R2. What it caught
- `content/sleeptalk.json` (Claude): `{ _note, nights: { "<day>": { name: string, lines: string[] } } }`, strict loader, en twin `content/en/sleeptalk.json` (same days).
- The next morning, a recording made on night N appears in 文件 → 下载 as a file named `nights[N].name`, its body the lines; played on the walkman (drag into it / open with it) the lines come as dialogue, reversed play shows the last line.
- No recording that night → no file. Nothing else depends on it (day 12's lock keeps its own file).

## R3. Strings (Claude adds): `obj.key.tape.rec` 录音 · Record; `obj.works.recNight` 只有夜里在床头才录得到。· It only records at the bedside, at night.

## R4. Tests
- rec at 床 at night → one `record` event; anywhere else or by day → the line, no event; upgraded → no rec.
- Next day the file exists with content's name and lines; without a recording, no file; the twin is checked.
