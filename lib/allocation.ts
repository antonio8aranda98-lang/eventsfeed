import { eligibleSlots, formationSlots, type SlotId } from './formation';
import { MAX_TEAMS, MIN_TEAMS, type Player } from './model';

export type AllocationPlayer = Pick<Player, 'id' | 'name' | 'position' | 'attendance'>;
export type AllocationRole = SlotId | 'unknown';
export type TeamSummary = { team: number; count: number; goalkeepers: number; defenders: number; midfielders: number; forwards: number; unknown: number; coverage: number; missingSlots: string[] };
export type AllocationResult = { teamCount: number; present: number; assignments: { id: string; team: number; role: AllocationRole }[]; teams: TeamSummary[]; warnings: string[] };
const roles: AllocationRole[] = [...formationSlots.map(slot => slot.id), 'unknown'];
export function suggestedTeamCount(attendees: number) { return Math.max(MIN_TEAMS, Math.min(MAX_TEAMS, Math.ceil(attendees / 20))); }

function fingerprint(value: string) {
  let result = 2166136261;
  for (let i = 0; i < value.length; i++) result = Math.imul(result ^ value.charCodeAt(i), 16777619);
  return result >>> 0;
}
type Edge = { to: number; reverse: number; capacity: number; cost: number };

/** Minimum-cost flow: exact team sizes, one reference position per player,
 * priority for distinct 4-3-3 coverage and a convex cost for repeated roles.
 * Reverse edges can move earlier choices to accommodate versatile players.
 */
export function allocatePlayers(roster: AllocationPlayer[], teamCount: number, seed = ''): AllocationResult {
  if (!Number.isInteger(teamCount) || teamCount < MIN_TEAMS || teamCount > MAX_TEAMS) throw Error(`Elige entre ${MIN_TEAMS} y ${MAX_TEAMS} equipos.`);
  const present = roster.filter(player => player.attendance === 'present');
  if (present.length < teamCount) throw Error('Debe haber al menos un jugador presente por equipo.');
  if (present.length > 300) throw Error('El reparto automático admite hasta 300 jugadores presentes.');
  if (new Set(present.map(player => player.id)).size !== present.length) throw Error('Hay identificadores de jugadores duplicados.');
  const players = [...present].sort((a, b) => fingerprint(seed + a.id) - fingerprint(seed + b.id) || a.id.localeCompare(b.id));
  const targets = Array.from({ length: teamCount }, (_, i) => Math.floor(players.length / teamCount) + (i < players.length % teamCount ? 1 : 0));
  const source = 0, roleStart = players.length + 1, teamStart = roleStart + teamCount * roles.length, sink = teamStart + teamCount;
  const graph: Edge[][] = Array.from({ length: sink + 1 }, () => []);
  function edge(from: number, to: number, capacity: number, cost: number) {
    const forward = { to, reverse: graph[to].length, capacity, cost };
    graph[from].push(forward);
    graph[to].push({ to: from, reverse: graph[from].length - 1, capacity: 0, cost: -cost });
    return forward;
  }
  const options: { edge: Edge; team: number; role: AllocationRole }[][] = [];
  players.forEach((player, index) => {
    const node = index + 1;
    edge(source, node, 1, 0);
    const positions: AllocationRole[] = eligibleSlots(player.position);
    if (!positions.length) positions.push('unknown');
    const teamOrder = Array.from({ length: teamCount }, (_, i) => i).sort((a, b) => fingerprint(seed + player.id + a) - fingerprint(seed + player.id + b));
    options[index] = teamOrder.flatMap(team => positions.map(role => ({ team: team + 1, role, edge: edge(node, roleStart + team * roles.length + roles.indexOf(role), 1, 0) })));
  });
  for (let team = 0; team < teamCount; team++) {
    roles.forEach((role, roleIndex) => {
      const roleNode = roleStart + team * roles.length + roleIndex;
      for (let rank = 0; rank < targets[team]; rank++) {
        const coverageReward = rank === 0 ? (role === 'gk' ? 12000 : role === 'unknown' ? 0 : 6000) : 0;
        const repeatCost = rank * (role === 'gk' || role === 'unknown' ? 120 : 80);
        edge(roleNode, teamStart + team, 1, repeatCost - coverageReward);
      }
    });
    edge(teamStart + team, sink, targets[team], 0);
  }
  for (let flow = 0; flow < players.length; flow++) {
    const distances = Array(graph.length).fill(Infinity), previousNode = Array(graph.length).fill(-1), previousEdge = Array(graph.length).fill(-1), queued = Array(graph.length).fill(false);
    distances[source] = 0;
    const queue = [source]; queued[source] = true;
    for (let head = 0; head < queue.length; head++) {
      const node = queue[head]; queued[node] = false;
      graph[node].forEach((candidate, index) => {
        if (!candidate.capacity || distances[candidate.to] <= distances[node] + candidate.cost) return;
        distances[candidate.to] = distances[node] + candidate.cost;
        previousNode[candidate.to] = node; previousEdge[candidate.to] = index;
        if (!queued[candidate.to]) { queue.push(candidate.to); queued[candidate.to] = true; }
      });
    }
    if (previousNode[sink] === -1) throw Error('No se ha podido completar el reparto.');
    for (let node = sink; node !== source; node = previousNode[node]) {
      const chosen = graph[previousNode[node]][previousEdge[node]];
      chosen.capacity--;
      graph[node][chosen.reverse].capacity++;
    }
  }
  const assignments = players.map((player, i) => {
    const selected = options[i].find(option => option.edge.capacity === 0);
    if (!selected) throw Error('Un jugador se ha quedado sin equipo.');
    return { id: player.id, team: selected.team, role: selected.role };
  });
  const summaries = targets.map((_, i): TeamSummary => {
    const team = i + 1, members = assignments.filter(player => player.team === team);
    const count = (ids: AllocationRole[]) => members.filter(player => ids.includes(player.role)).length;
    const missing = formationSlots.filter(slot => !members.some(player => player.role === slot.id));
    return { team, count: members.length, goalkeepers: count(['gk']), defenders: count(['lb', 'lcb', 'rcb', 'rb']), midfielders: count(['dm', 'lcm', 'rcm']), forwards: count(['lw', 'st', 'rw']), unknown: count(['unknown']), coverage: 11 - missing.length, missingSlots: missing.map(slot => slot.name) };
  });
  const warnings: string[] = [];
  const withoutKeeper = summaries.filter(team => !team.goalkeepers);
  if (withoutKeeper.length) warnings.push(`${withoutKeeper.length} ${withoutKeeper.length === 1 ? 'equipo queda' : 'equipos quedan'} sin portero: no hay suficientes jugadores disponibles para cubrir ese puesto en todos los equipos.`);
  const unknown = assignments.filter(player => player.role === 'unknown').length;
  if (unknown) warnings.push(`${unknown} ${unknown === 1 ? 'jugador tiene' : 'jugadores tienen'} la posición sin indicar o sin reconocer. Se han repartido por número; puedes corregir sus fichas y reorganizar.`);
  const shortages = summaries.filter(team => team.coverage < 11);
  if (shortages.length) warnings.push('El resumen señala los puestos del 4-3-3 que no se han podido cubrir con jugadores distintos. Puedes revisarlos en el campo de cada equipo.');
  return { teamCount, present: present.length, assignments, teams: summaries, warnings };
}
