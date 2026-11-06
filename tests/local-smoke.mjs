import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:5173/api/';
const code=readFileSync('.dev.vars','utf8').match(/^ADMIN_PASSWORD=(.+)$/m)?.[1];
async function request(path,body,cookie){const res=await fetch(base+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Origin:'http://127.0.0.1:5173',...(cookie?{cookie}:{})},body:body?JSON.stringify(body):undefined});const data=await res.json();assert.equal(res.status,200,JSON.stringify(data));return {data,cookie:res.headers.get('set-cookie')?.split(';')[0]};}
const admin=(await request('login',{code})).cookie;
const event=(await request('events',{name:'Prueba local · 80 jugadores ficticios'},admin)).data.id;
const people=Array.from({length:80},(_,i)=>({name:`Jugador de prueba ${i+1}`,birthyear:'2008',club:'Club ficticio',position:i%11===0?'POR':'MC',phone:'SOLO-PRUEBA'}));
await request('import',{event,players:people},admin);
let state=(await request('state?event='+event,undefined,admin)).data;
for(let i=0;i<state.players.length;i++)await request('player',{id:state.players[i].id,version:0,team:i%4+1,attendance:'present'},admin);
const coaches=[];
for(let team=1;team<=4;team++){const access=(await request('access',{event,team},admin)).data.code;const cookie=(await request('login',{code:access})).cookie;coaches.push(cookie);const own=(await request('state',undefined,cookie)).data;assert.equal(own.players.length,20);assert(own.players.every(p=>p.team===team&&!p.phone));await request('evaluation',{id:own.players[0].id,version:0,scores:[8,7,9,8],comment:'Validación local del guardado',category:'Preferente juvenil'},cookie);}
state=(await request('state?event='+event,undefined,admin)).data;assert.equal(state.players.filter(p=>p.evaluation).length,4);
const p=state.players.find(p=>p.team===1);await request('news',{event,player:p.id,kind:'goal',requestId:crypto.randomUUID()},coaches[0]);
const speakerCode=(await request('access',{event,team:0},admin)).data.code;const speaker=(await request('login',{code:speakerCode})).cookie;const speech=(await request('state',undefined,speaker)).data;assert.equal(speech.players.length,0);assert.equal(speech.news.length,1);await request('announce',{id:speech.news[0].id,announced:true},speaker);
console.log('PASS: local HTTP + real D1 — 80 imports, 4 teams of 20, 4 simultaneous sessions, persisted assessments, speaker goal and acknowledgement.');
