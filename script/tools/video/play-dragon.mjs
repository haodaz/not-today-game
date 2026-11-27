// The greater Kuro on his own (room3d ?great=1): waits until the whole of him is there, turns the swimming up, then runs a camera
// path given as keyframes [seconds, {zoom, px, py, rx, ry}] in KEYS (JSON), eased between. Ends after the last key.
export default async function ({ ev, sleep, mark }) {
  for (let i = 0; i < 60; i++) { const st = await ev("(()=>{const p=window.proto; return p&&p.CON? JSON.stringify({at:!!p.CON.at,told:!!p.CON.told,k:+(p.FAR.k||0).toFixed(2)}) : ''})()"); if (st && (JSON.parse(st).told || (JSON.parse(st).at && i > 44))) break; await sleep(0.5); }
  mark("the whole of him");
  const keys = process.env.KEYS || "[[0,{\"zoom\":1,\"px\":0,\"py\":0,\"rx\":0,\"ry\":0}],[10,{\"zoom\":1,\"px\":0,\"py\":0,\"rx\":0,\"ry\":0}]]";
  const amp = process.env.AMP || "2.2", rate = process.env.RATE || "4", lead = process.env.LEAD || "55", dust = process.env.DUST || "90";
  await ev(`(()=>{ const P=window.proto, C=P.CON, U=P.U; U.uSwimAmp.value=${amp}; U.uSwimRate.value=${rate}; U.uSwimLead.value=${lead}; C.dustV=${dust}; C.murkV=${Number(dust) * 0.45}; const K=${keys}, t0=performance.now();
    const sm=(a,b,x)=>{x=Math.min(1,Math.max(0,(x-a)/(b-a)));return x*x*(3-2*x)};
    function f(){ const t=(performance.now()-t0)/1000; let i=0; while(i<K.length-2&&t>K[i+1][0]) i++; const A=K[i][1],B=K[i+1][1],u=sm(K[i][0],K[i+1][0],t); for(const k in A) C[k]=A[k]+(B[k]-A[k])*u; if(t<K[K.length-1][0]+1) requestAnimationFrame(f);} f(); return 1; })()`);
  mark("film start"); const end = JSON.parse(keys).slice(-1)[0][0]; await sleep(end + 0.3); mark("film end");
}
