import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const compile=source=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText).toString('base64');
const modelURL=compile(readFileSync('lib/model.ts','utf8'));
const formationURL=compile(readFileSync('lib/formation.ts','utf8'));
const allocationURL=compile(readFileSync('lib/allocation.ts','utf8').replace("from './formation'",`from '${formationURL}'`).replace("from './model'",`from '${modelURL}'`));
const {allocatePlayers,suggestedTeamCount}=await import(allocationURL);
const {eligibleSlots}=await import(formationURL);
const profile=['POR','POR','LI','LI','DFC','DFC','DFC','LD','LD','MCD','MCD','MC','MC','MC','EI','EI','ED','ED','DC','DC'];
function roster(n,positions=profile){return Array.from({length:n},(_,i)=>({id:'p'+i,name:'Ficticio '+i,position:positions[i%positions.length],attendance:'present'}));}
let checks=0;function check(condition,message){assert.ok(condition,message);checks++;}
function validate(players,count){const before=JSON.stringify(players);const plan=allocatePlayers(players,count,'fixture');const present=players.filter(p=>p.attendance==='present');check(plan.assignments.length===present.length,'Every attendee assigned');check(new Set(plan.assignments.map(p=>p.id)).size===present.length,'No duplicate assignments');check(plan.teams.length===count,'Requested team count');const sizes=plan.teams.map(t=>t.count);check(Math.max(...sizes)-Math.min(...sizes)<=1,'Exact balanced team sizes');check(plan.assignments.every(a=>a.team>=1&&a.team<=count),'Team numbers in range');check(plan.assignments.every(a=>{const slots=eligibleSlots(players.find(p=>p.id===a.id).position);return slots.length?slots.includes(a.role):a.role==='unknown';}),'One compatible reference role per player');check(plan.teams.every(t=>t.count===t.goalkeepers+t.defenders+t.midfielders+t.forwards+t.unknown),'Polivalent player counted once');check(JSON.stringify(players)===before,'Input records unchanged');return plan;}
check(eligibleSlots('constructor').length===0&&eligibleSlots('__proto__').length===0,'Unknown input never resolves inherited object keys');
check(JSON.stringify(eligibleSlots('EXT DER'))===JSON.stringify(eligibleSlots('ED')),'EXT DER is recognized as right winger');
check(JSON.stringify(eligibleSlots('EXT IZQ'))===JSON.stringify(eligibleSlots('EI')),'EXT IZQ is recognized as left winger');
check(JSON.stringify(eligibleSlots('  Ext.   Der.  '))===JSON.stringify(['rw'])&&JSON.stringify(eligibleSlots('ext. izq.'))===JSON.stringify(['lw']),'Winger aliases tolerate case, dots and whitespace');
const canonicalWingers=roster(80);const csvWingers=canonicalWingers.map(p=>({...p,position:p.position==='ED'?'EXT DER':p.position==='EI'?'EXT IZQ':p.position}));
check(JSON.stringify(allocatePlayers(csvWingers,4,'wingers'))===JSON.stringify(allocatePlayers(canonicalWingers,4,'wingers')),'CSV winger aliases produce identical team allocation to ED/EI');
let plan=validate(roster(80),4);check(plan.teams.every(t=>t.count===20&&t.goalkeepers===2&&t.coverage===11),'80 players: 4 complete balanced squads');
plan=validate(roster(100),5);check(plan.teams.every(t=>t.count===20&&t.goalkeepers===2&&t.coverage===11),'100 players: 5 complete balanced squads');
plan=validate(roster(50),3);check(plan.teams.map(t=>t.count).join(',')==='17,17,16','50 players: 17/17/16');
check(suggestedTeamCount(50)===3&&suggestedTeamCount(80)===4&&suggestedTeamCount(100)===5,'Suggestions match requested scenarios');
const scarce=roster(80,['MC']);for(let i=0;i<3;i++)scarce[i].position='POR';plan=validate(scarce,4);check(plan.teams.map(t=>t.goalkeepers).sort().join(',')==='0,1,1,1','Scarce keepers spread before doubling');check(plan.warnings.some(w=>w.includes('sin portero')),'Keeper shortage explained');
plan=validate(roster(50,['Sin especificar']),3);check(plan.assignments.every(p=>p.role==='unknown')&&plan.warnings.length>0,'Unknown positions retained without inventing roles');
plan=validate(roster(40,['Central izquierdo']),4);check(plan.assignments.every(p=>p.role==='lcb'),'No invented right-sided eligibility');
const flexible=roster(8,['POR','POR','DFC','DFC','LI','DFC/LI','DC','DC']);plan=validate(flexible,2);check(plan.teams.every(t=>t.goalkeepers===1&&t.coverage===4),'Versatile player resolves constrained covering');
const mixed=roster(25);mixed[0].attendance='absent';mixed[1].attendance='pending';plan=validate(mixed,3);check(plan.present===23&&!plan.assignments.some(p=>['p0','p1'].includes(p.id)),'Absent/pending never allocated');
const stable=roster(80);check(JSON.stringify(allocatePlayers(stable,4,'seed'))===JSON.stringify(allocatePlayers([...stable].reverse(),4,'seed')),'Stable result independent of input ordering');
for(const count of [0,1,11,2.5])assert.throws(()=>allocatePlayers(roster(80),count));assert.throws(()=>allocatePlayers(roster(2),3));assert.throws(()=>allocatePlayers(roster(301),5));checks+=6;
const started=performance.now();plan=validate(roster(300),10);check(plan.teams.every(t=>t.count===30),'300 players / 10 teams');const elapsed=performance.now()-started;
console.log(`PASS: ${checks} allocation checks; 300-player optimizer ${Math.round(elapsed)} ms.`);
