'use client';
import { ArrowUp, ChevronRight, Users } from 'lucide-react';
import { teamAppearance, type TeamSettings, type Player } from '@/lib/model';
import { teamAvailability } from '@/lib/formation';
import './formation.css';

type Props = { players: Player[]; team: number; settings: TeamSettings; onPlayer: (player: Player) => void };

function AvailablePlayer({ player, onPlayer }: { player: Player; onPlayer: Props['onPlayer'] }) {
  return <button type="button" className="formation-player" onClick={() => onPlayer(player)} aria-label={`Abrir ficha de ${player.name}`} title={`${player.name} · ${player.position || 'Sin posición'}`}>
    {player.number && <span className="formation-dorsal">{player.number}</span>}
    <span>{player.name}</span><ChevronRight size={12} aria-hidden="true" />
  </button>;
}

export default function FormationBoard({ players, team: teamId, settings, onPlayer }: Props) {
  const team = teamAppearance(teamId, settings);
  const availability = teamAvailability(players, teamId);
  return <section className="formation-panel" aria-label={`Esquema 4-3-3 de ${team.name}`} style={{ '--formation-team': team.color } as React.CSSProperties}>
    <header className="formation-heading"><div><span className="eyebrow">DISPONIBLES POR POSICIÓN</span><h2><span className="team-dot" style={{ background: team.color }} />{team.name}<span className="formation-system">4-3-3</span></h2><p>{availability.players.length} jugadores presentes · Toca un nombre para abrir su ficha.</p></div><span className="formation-count"><Users size={15} />{availability.players.length}</span></header>
    <p className="formation-explainer">Cada puesto muestra todas las opciones compatibles. Los centrales, interiores y jugadores polivalentes pueden aparecer en varios puestos.</p>
    <div className="formation-field">
      <svg className="formation-lines" viewBox="0 0 700 1000" preserveAspectRatio="none" aria-hidden="true"><rect x="15" y="15" width="670" height="970" rx="4" /><path d="M15 500H685M180 15V150H520V15M270 15V70H430V15M180 985V850H520V985M270 985V930H430V985" /><circle cx="350" cy="500" r="90" /><circle cx="350" cy="500" r="3" /><path d="M280 150Q350 235 420 150M280 850Q350 765 420 850" /></svg>
      <div className="formation-direction"><ArrowUp size={13} /> ATAQUE</div>
      {(['attack', 'interiors', 'pivot', 'defence', 'goalkeeper'] as const).map(row => <div className={`formation-row formation-${row}`} key={row}>
        {availability.slots.filter(slot => slot.row === row).map(slot => <section key={slot.id} className={`formation-slot ${slot.players.length ? 'has-players' : 'is-empty'}`} aria-label={`${slot.name}: ${slot.players.length} disponibles`}>
          <div className="formation-slot-heading"><h3 title={slot.name}>{slot.code}</h3><span>{slot.players.length}</span></div>
          <p className="formation-position-name">{slot.name}</p>
          {slot.players.length ? <div className="formation-candidates">{slot.players.map(player => <AvailablePlayer key={player.id} player={player} onPlayer={onPlayer} />)}</div> : <p className="formation-no-players">Sin jugadores</p>}
        </section>)}
      </div>)}
    </div>
    <footer className="formation-footnote">MC y MCO se muestran como interiores. La posición se puede ajustar en «Ficha del jugador».</footer>
    {availability.unplaced.length > 0 && <div className="formation-unplaced"><div><h3>Posición por revisar <span>{availability.unplaced.length}</span></h3><p>Abre la ficha y especifica la posición para situar al jugador en el campo.</p></div><div>{availability.unplaced.map(player => <div className="formation-unplaced-player" key={player.id}><AvailablePlayer player={player} onPlayer={onPlayer} /><small>{player.position || 'Sin posición indicada'}</small></div>)}</div></div>}
    {availability.players.length === 0 && <p className="formation-empty-team">Los jugadores aparecerán al marcar su asistencia y asignarlos a este equipo en el check-in.</p>}
  </section>;
}
