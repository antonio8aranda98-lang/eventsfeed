'use client';
import { useState } from 'react';
import { Check, LoaderCircle, RotateCcw, ShieldCheck } from 'lucide-react';
import { eventTeams, teamAppearance, teamInk, type EventInfo, type EventTeam } from '@/lib/model';
import './team-editor.css';

type Props = { event: EventInfo; busy: boolean; demo: boolean; onSave: (teams: EventTeam[], version: number) => Promise<void> };
export default function TeamEditor({ event, busy, demo, onSave }: Props) {
  const [draft, setDraft] = useState(() => eventTeams(event.teamCount, event.teamSettings));
  const [version] = useState(event.teamSettingsVersion);
  const [working, setWorking] = useState(false), [error, setError] = useState('');
  function update(id: number, change: Partial<EventTeam>) { setDraft(previous => previous.map(team => team.id === id ? { ...team, ...change } : team)); }
  async function save(e: React.FormEvent) {
    e.preventDefault(); setWorking(true); setError('');
    try { await onSave(draft, version); } catch (error: any) { setError(error.message || 'No se han podido guardar los equipos.'); }
    finally { setWorking(false); }
  }
  return <form className="team-editor" onSubmit={save}>
    <p className="team-editor-event">{event.name}</p>
    <div className="team-editor-list">{draft.map(team => <div className="team-editor-row" key={team.id}>
      <div className="team-editor-preview" style={{ background: team.color + '18', color: teamInk(team.color), borderColor: team.color }}><ShieldCheck size={22}/><span>{String(team.id).padStart(2, '0')}</span></div>
      <label className="field team-editor-name">Nombre del equipo {team.id}<input required maxLength={40} value={team.name} disabled={busy || working} onChange={e => update(team.id, { name: e.target.value })}/></label>
      <div className="team-editor-color"><label htmlFor={`team-color-${team.id}`}>Color</label><div><input id={`team-color-${team.id}`} type="color" aria-label={`Color del equipo ${team.id}`} value={/^#[0-9a-f]{6}$/i.test(team.color) ? team.color : '#344b2c'} disabled={busy || working} onChange={e => update(team.id, { color: e.target.value })}/><input className="team-editor-hex" aria-label={`Código de color del equipo ${team.id}`} required pattern="#[0-9a-fA-F]{6}" maxLength={7} value={team.color} disabled={busy || working} onChange={e => update(team.id, { color: e.target.value })}/></div></div>
      <button className="icon-btn team-editor-reset" type="button" aria-label={`Restablecer equipo ${team.id}`} title="Restablecer nombre y color" disabled={busy || working} onClick={() => update(team.id, teamAppearance(team.id))}><RotateCcw size={16}/></button>
    </div>)}</div>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="form-foot"><span>{demo ? 'Ejemplo: los cambios se perderán al salir.' : 'Los cambios aparecerán también en las tablets y en el speaker.'}</span><button className="btn primary" disabled={busy || working}>{working ? <LoaderCircle size={17} className="spin"/> : <Check size={17}/>} Guardar equipos</button></div>
  </form>;
}
