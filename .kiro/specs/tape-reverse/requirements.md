# tape-reverse — requirements (2026-11-05, Claude; follows tape-record)

The sleep-talk recordings hide one line that only playing the tape backwards brings out. Today that line is written into the recording as 「倒着放：……」 and plays forwards with the rest. Make backwards play real, the way auto-reverse walkmans did it: a direction key.

## R1. The direction key
- The drawn walkman gets a `dir` key (label ⇄, string `obj.key.tape.dir`), the same size and style as `vol+` / `vol-`, placed directly left of `vol-`. Not on the upgraded walkman (Kuro transcribes; nothing is hidden from it, and nothing is found).
- Pressing it toggles `reverse` in the tape state (session only, logs nothing). A small ◀ or ▶ (11px, the label colour) sits under the reel window and shows the current direction. While playing in reverse, both reels turn the other way (negate the existing rotation; same speed).
- `dir` while playing: stops the current line (`stopSay`, as `stop` does) and flips the direction; it does not start playing.

## R2. What plays backwards
- `content/sleeptalk.json` nights gain an optional `backwards: string` (non-empty). The strict loader accepts it; the twin check requires it in both files or in neither.
- Forward play of a sleep-talk recording: its `lines`, as today. Reverse play: only `backwards` as one narration line; a night without `backwards` gives the string `obj.tape.reverseNone`.
- Reverse play of any other recording: one narration line, `obj.tape.reverseNone`, under the usual hiss.
- The file in 文件 → 下载: body = `lines`; when the night has `backwards`, one more line at the end: the string `files.sleeptalk.backHint`. The backwards text itself never appears in the file.
- The upgraded walkman's transcript lists `lines` only.

## R3. Strings (Claude's, already in zh + en)
`obj.key.tape.dir`, `obj.tape.reverseNone`, `files.sleeptalk.backHint`.

## R4. Content (Claude, after this lands)
Claude moves each night's 「倒着放：……」 line out of `lines` into `backwards` (zh and en). Until then the content has no `backwards` and nothing changes on screen.

## R5. Tests
- `dir` toggles reverse, stops a line in progress, logs nothing; absent when upgraded.
- With a fixture night that has `backwards`: forward play speaks `lines`, reverse play speaks only `backwards`; a night without it and an ordinary recording speak `obj.tape.reverseNone` in reverse.
- The 下载 file shows `lines` + the hint, never the backwards text; the transcript has no backwards text.
- Loader: `backwards` empty fails; present in zh but not en fails.
