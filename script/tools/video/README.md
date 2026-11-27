# Video takes and cuts

Tools used for the submission video (2026-11-27). They record the game from a headless Chrome that uses the GPU, so nothing opens on the screen, and frames go straight into ffmpeg.

- `rec-page.mjs <url> <out.mp4> <max seconds>`: records one page. `SCALE=1.2` gives 1920×1080, `SCALE=2` gives 3200×1800. `PLAY=<module>` runs a play script and ends the take when it returns; a `<out>.marks.txt` lists what happened at which second.
- Play scripts: `play-lines.mjs` reads a story at reading pace, `play-fight.mjs` plays the day-18 fight and the pages after it, `play-clear.mjs` reads the lines away and holds the clean view, `play-launch.mjs` holds a task's launch poster and starts it.
- Whole days come from the replay driver: `REC=<file.mp4> LOOK=real DESK=photo NAMES="login|nick|calledBy|bossCalls|she|p1" node script/tools/auto-day-shoot.mjs <day> en <dir>`; `PAC_BOT=1` plays the day-18 corridor with `script/tools/pacbot.js`, `GAME_HOLD=<s>` stays in a small game before the dev cheat ends it.
- Jump URLs on the replay bundle: `?day=N&prologue=1`, `&night=1`, `&view=desk|room|window`, `&launch=<taskId>`, `&boss=good|survive|bad`, `&seed=found:all,recognised:all,fullness:80`, `&names=…`.
- `edl-full.mjs` writes the edit list of the full cut (the author's nine first-person lines are its spine); `cut.mjs <edl.json> <out.mp4>` lays clips, stills and title cards over the song and reports any part whose source ran out. `sheet.sh` makes a contact sheet for checking a take or a cut.

Paths inside these scripts point at this machine's ffmpeg and at the session scratch folder where the raw takes were kept; change them before reuse.
