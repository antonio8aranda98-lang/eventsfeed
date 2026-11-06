import type { Player } from './model';

export const formationSlots = [
  { id: 'lw', code: 'EI', name: 'Extremo izquierdo', row: 'attack' },
  { id: 'st', code: 'DC', name: 'Delantero centro', row: 'attack' },
  { id: 'rw', code: 'ED', name: 'Extremo derecho', row: 'attack' },
  { id: 'lcm', code: 'MC · IZQ', name: 'Interior izquierdo', row: 'interiors' },
  { id: 'rcm', code: 'MC · DER', name: 'Interior derecho', row: 'interiors' },
  { id: 'dm', code: 'MCD', name: 'Pivote', row: 'pivot' },
  { id: 'lb', code: 'LI', name: 'Lateral izquierdo', row: 'defence' },
  { id: 'lcb', code: 'DFC · IZQ', name: 'Central izquierdo', row: 'defence' },
  { id: 'rcb', code: 'DFC · DER', name: 'Central derecho', row: 'defence' },
  { id: 'rb', code: 'LD', name: 'Lateral derecho', row: 'defence' },
  { id: 'gk', code: 'POR', name: 'Portero', row: 'goalkeeper' },
] as const;
export type SlotId = typeof formationSlots[number]['id'];

const aliases: Record<string, readonly SlotId[]> = Object.create(null);
function register(names: string[], slots: SlotId[]) {
  for (const name of names) aliases[name] = slots;
}
register(['por', 'pt', 'gk', 'portero', 'portera', 'guardameta', 'arquero'], ['gk']);
register(['li', 'lb', 'cai', 'lwb', 'lateral izquierdo', 'carrilero izquierdo'], ['lb']);
register(['ld', 'rb', 'cad', 'rwb', 'lateral derecho', 'carrilero derecho'], ['rb']);
register(['dfc', 'cb', 'central', 'defensa central', 'centrales'], ['lcb', 'rcb']);
register(['dfci', 'lcb', 'central izquierdo'], ['lcb']);
register(['dfcd', 'rcb', 'central derecho'], ['rcb']);
register(['mcd', 'cdm', 'dm', 'pivote', 'pivot', 'mediocentro defensivo', 'medio centro defensivo'], ['dm']);
register(['mc', 'cm', 'mediocentro', 'medio centro', 'centrocampista', 'interior', 'mco', 'mp', 'cam', 'mediapunta', 'media punta', 'medio ofensivo', 'mediocentro ofensivo'], ['lcm', 'rcm']);
register(['mci', 'lcm', 'interior izquierdo', 'mediocentro izquierdo'], ['lcm']);
register(['mcr', 'rcm', 'interior derecho', 'mediocentro derecho'], ['rcm']);
register(['ei', 'lw', 'mi', 'extremo izquierdo', 'extremo izquierda', 'volante izquierdo', 'medio izquierdo'], ['lw']);
register(['ed', 'rw', 'md', 'extremo derecho', 'extremo derecha', 'volante derecho', 'medio derecho'], ['rw']);
register(['dc', 'st', 'cf', 'delantero', 'delantero centro', 'delantero central', 'punta', 'sd', 'segundo delantero'], ['st']);
register(['extremo', 'extremos'], ['lw', 'rw']);

export function eligibleSlots(position: string): SlotId[] {
  const normalized = position.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\./g, '').trim().replace(/\s+/g, ' ');
  const parts = normalized.split(/\s*(?:[,;/+|&\-]|\by\b)\s*/).filter(Boolean);
  return [...new Set(parts.flatMap(part => aliases[part] || []))];
}

export function teamAvailability(players: Player[], team: number) {
  const present = players.filter(player => player.team === team && player.attendance === 'present');
  const candidates = present.map(player => ({ player, slots: eligibleSlots(player.position) }));
  return {
    players: present,
    slots: formationSlots.map(slot => ({ ...slot, players: candidates.filter(candidate => candidate.slots.includes(slot.id)).map(candidate => candidate.player) })),
    unplaced: candidates.filter(candidate => candidate.slots.length === 0).map(candidate => candidate.player),
  };
}
