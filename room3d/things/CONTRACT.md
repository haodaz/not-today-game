# Things in the room: the contract (v1, 2026-11-25)

Borrowed from the author's Gemiverse engine: the room is a fixed shell with **named slots**, and each
thing in it is **one module built to one contract**, so polishing one thing (one object a round)
never touches another, and what a day does to a thing is a parameter of that thing.

`room3d/room.js` used to build everything inline. New and re-polished things move here one at a
time; the rest stay inline until their turn. Moved so far: `carton.js`, `bin.js`.

## A thing

```js
// room3d/things/<id>.js
export default {
  id: "carton",        // unique; the same id the game uses if the game talks about it
  slot: "carton",      // a key of SLOTS in room.js: where it stands (x, y, z on the floor or a surface, ry)
  float: 0.3,          // optional: how far it drifts when the room comes apart (late days)
  build(kit) {         // draws the thing at its own origin (on the floor / the surface it stands on)
    kit.box(...);      // kit: THREE, M, mat, box, cyl, ball, torus, tube, lathe, keys, label, face, add, into
    return {           // optional hooks
      onDay(day, look) {},   // the day changed; look = { collapse, pixel, unreal } (dayLook)
    };
  },
};
```

## Rules
- A thing draws only itself, at its own origin, through `kit`. It never reads `state`, the game or
  another thing. What a day does to it comes in through `onDay`.
- Its place is the slot's. Moving a thing = changing its slot in `SLOTS`, never its drawing.
- Whether a thing reads a fact of the run is decided in `docs/room-readout.md`; furniture reads none.
- Messages with the game stay in `room3d/PROTOCOL.md`; a thing has no messages of its own.
