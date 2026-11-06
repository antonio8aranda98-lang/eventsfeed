'use client';
import { useEffect, useState } from 'react';
import { AlertCircle, CheckCheck, LoaderCircle, Shuffle } from 'lucide-react';
import { MAX_TEAMS, MIN_TEAMS, type EventInfo, type Player } from '@/lib/model';
import { suggestedTeamCount, type AllocationResult } from '@/lib/allocation';
import './organizer.css';

type Result = AllocationResult & { revision: number };
type Props = { event: EventInfo; players: Player[]; busy: boolean; demo: boolean; onOrganize: (count: number) => Promise<Result> };
export default function TeamOrganizer({ event, players, busy, demo, onOrganize }: Props) {
  const [count, setCount] = useState(event.teamCount), [working, setWorking] = useState(false), [error, setError] = useState(''), [result, setResult] = useState<Result | null>(null);
  useEffect(() => { setCount(event.teamCount); setResult(null); setError(''); }, [event.id]);
  useEffect(() => { setCount(event.teamCount); }, [event.teamCount]);
  const present = players.filter(player => player.attendance === 'present').length;
  const pending = players.filter(player => player.attendance === 'pending').length;
  const absent = players.filter(player => player.attendance === 'absent').length;
  const suggestion = suggestedTeamCount(present);
  const counts = `${Math.floor(present / count)}${present % count ? '–' + Math.ceil(present / count) : ''}`;
  const blocked = busy || (!demo && pending > 0) || present < count || event.status === 'closed';
  async function organize() {
    if (blocked) return;
    if (!demo && players.some(player => player.team > 0) && !confirm('Se repartirá de nuevo a todos los asistentes. Se conservan sus fichas y valoraciones. Los accesos de los equipos que desaparezcan se cerrarán. ¿Organizar los equipos?')) return;
    setWorking(true); setError('');
    try { const response = await onOrganize(count); setResult(response); }
    catch (error: any) { setError(error.message || 'No se ha podido organizar. Inténtalo de nuevo.'); }
    finally { setWorking(false); }
  }
  return <section className="organizer" aria-label="Organizar equipos automáticamente">
    <header><span className="organizer-symbol"><Shuffle size={23} /></span><div><span className="eyebrow">DEL CHECK-IN AL CAMPO</span><h2>Los equipos se organizan solos.</h2><p>Confirma la asistencia, elige cuántos equipos quieres y reparte a los jugadores por posiciones.</p></div></header>
    <div className="organizer-attendance"><span><b>{present}</b> presentes</span><span><b>{absent}</b> no asisten</span><span className={pending ? 'pending' : ''}><b>{pending}</b> pendientes</span></div>
    <div className="organizer-controls"><label htmlFor="team-count">Número de equipos<select id="team-count" value={count} disabled={busy || working || event.status === 'closed'} onChange={e => { setCount(Number(e.target.value)); setError(''); }}>{Array.from({ length: MAX_TEAMS - MIN_TEAMS + 1 }, (_, i) => MIN_TEAMS + i).map(n => <option key={n} value={n}>{n} equipos</option>)}</select></label><div className="organizer-suggestion"><strong>{present ? `${counts} jugadores por equipo` : 'Confirma las asistencias para empezar'}</strong>{present >= MIN_TEAMS && <button disabled={busy || event.status === 'closed'} onClick={() => setCount(suggestion)}>Sugerencia: {suggestion} equipos · usar esta opción</button>}</div><button className="btn primary" disabled={blocked || working} onClick={organize}>{working ? <><LoaderCircle size={17} className="spin" /> Repartiendo jugadores…</> : <><Shuffle size={17} />{demo ? 'Probar reparto de ejemplo' : 'Organizar equipos'}</>}</button></div>
    {!demo && pending > 0 && <p className="organizer-notice"><AlertCircle size={15} />Confirma «Asiste» o «No asiste» para los {pending} inscritos pendientes antes de organizar.</p>}
    {demo && <p className="organizer-notice">La prueba usa solo los {present} jugadores ficticios marcados como presentes. El reparto de ejemplo no se guarda.</p>}
    {present > 0 && present < count && <p className="organizer-notice">Necesitas al menos un jugador presente por equipo. Elige menos equipos.</p>}
    {event.status === 'closed' && <p className="organizer-notice">Reabre el evento para organizar los equipos.</p>}
    <p className="organizer-method">Se equilibran el tamaño de los equipos y los puestos del 4-3-3, dando prioridad a los porteros. Los jugadores polivalentes se cuentan una sola vez. Después puedes mover jugadores manualmente.</p>
    {error && <p className="error" role="alert">{error}</p>}
    {result && result.revision === event.rosterRevision && <div className="organizer-result" role="status"><h3><CheckCheck size={18} />{result.present} jugadores repartidos en {result.teamCount} equipos{demo ? ' · ejemplo' : ''}</h3><div className="organizer-summary-scroll"><table><thead><tr><th>EQUIPO</th><th>JUGADORES</th><th>POR</th><th>DEF</th><th>MED</th><th>DEL</th><th>SIN POS.</th><th>PUESTOS 4-3-3</th></tr></thead><tbody>{result.teams.map(team => <tr key={team.team}><td>Equipo {String(team.team).padStart(2, '0')}</td><td><strong>{team.count}</strong></td><td>{team.goalkeepers}</td><td>{team.defenders}</td><td>{team.midfielders}</td><td>{team.forwards}</td><td>{team.unknown}</td><td><details><summary>{team.coverage}/11 cubiertos</summary>{team.missingSlots.length ? <p>Por cubrir: {team.missingSlots.join(', ')}.</p> : <p>Todos los puestos se pueden cubrir con jugadores distintos.</p>}</details></td></tr>)}</tbody></table></div>{result.warnings.map(warning => <p key={warning} className="organizer-warning"><AlertCircle size={14} />{warning}</p>)}<p className="organizer-method">El resumen cuenta a cada jugador en un puesto de referencia. Sus posiciones originales y valoraciones se conservan.</p></div>}
  </section>;
}
