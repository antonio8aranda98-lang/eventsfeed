export const categories = ['Segunda juvenil', 'Primera juvenil', 'Preferente juvenil', 'Autonómica juvenil', 'Nacional juvenil', 'División de Honor juvenil', 'Segunda sénior', 'Primera sénior', 'Preferente sénior', 'Autonómica sénior', '3RFEF'];
export const MIN_TEAMS = 2;
export const MAX_TEAMS = 10;
const teamColors = ['#dd612c', '#5282c4', '#a487ce', '#50a38a', '#cc9740', '#c56b94', '#588d92', '#8c9560', '#8874b8', '#aa7755'];
export const teams = teamColors.map((color, i) => ({ id: i + 1, name: `Equipo ${String(i + 1).padStart(2, '0')}`, color }));
export type TeamAppearance = { name: string; color: string };
export type TeamSettings = Record<string, TeamAppearance>;
export type EventTeam = { id: number; name: string; color: string };
export function teamAppearance(id: number, settings: TeamSettings = {}): EventTeam {
    const base = teams.find(team => team.id === id) || { id, name: 'Sin equipo', color: '#a5aba6' };
    const custom = settings[String(id)];
    return { id, name: custom?.name || base.name, color: custom?.color || base.color };
}
export function eventTeams(count = 4, settings: TeamSettings = {}) { return teams.slice(0, Math.max(MIN_TEAMS, Math.min(MAX_TEAMS, count))).map(team => teamAppearance(team.id, settings)); }
export function teamInk(color: string) {
    const rgb = [1, 3, 5].map(start => parseInt(color.slice(start, start + 2), 16));
    return rgb[0] * .299 + rgb[1] * .587 + rgb[2] * .114 > 170 ? '#344b2c' : color;
}
export function parseTeamSettings(raw: string): TeamSettings {
    try { const value = JSON.parse(raw); return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; } catch { return {}; }
}
export function mergeTeamSettings(current: TeamSettings, changes: unknown, count: number): TeamSettings {
    if (!Array.isArray(changes) || !changes.length || changes.length > count) throw Error('Selecciona los equipos que quieres editar.');
    const next = { ...current }, seen = new Set<number>();
    for (const change of changes) {
        if (!change || !Number.isInteger(change.id) || change.id < 1 || change.id > count || seen.has(change.id)) throw Error('Uno de los equipos no pertenece a la lista actual del evento. Cierra y vuelve a abrir el editor.');
        if (typeof change.name !== 'string' || !change.name.trim() || change.name.trim().length > 40) throw Error('Cada equipo necesita un nombre de entre 1 y 40 caracteres.');
        if (typeof change.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(change.color)) throw Error('Elige un color válido para cada equipo.');
        seen.add(change.id);
        next[String(change.id)] = { name: change.name.trim().replace(/\s+/g, ' '), color: change.color.toLowerCase() };
    }
    return next;
}
export const metrics = ['Físico', 'Imagen', 'Técnico', 'Táctico'];
export type Player = {
    id: string;
    event: string;
    team: number;
    attendance: string;
    version: number;
    goals: number;
    name: string;
    position: string;
    club: string;
    birthyear: string;
    phone?: string;
    city?: string;
    currentCategory?: string;
    currentLeague?: string;
    number?: string;
    evaluation?: Evaluation;
};
export type Evaluation = {
    scores: (number | null)[];
    comment: string;
    category: string;
    version: number;
    updated?: number;
};
export type News = {
    id: string;
    event: string;
    team: number;
    player: string | null;
    text: string;
    kind: string;
    announced: number;
    created: number;
};
export type EventInfo = {
    teamSettings: TeamSettings;
    teamSettingsVersion: number;
    teamCount: number;
    rosterRevision: number;
    id: string;
    name: string;
    date: string;
    location: string;
    status: string;
};
export type State = {
    role: string;
    team: number;
    event: EventInfo | null;
    events: EventInfo[];
    players: Player[];
    news: News[];
    demo?: boolean;
};
export function demoState(): State {
    const names = ['Álex Romero', 'Daniel Martín', 'Lucas García', 'Hugo Santos', 'Pablo Navarro', 'Adrián Vega', 'Nicolás Torres', 'Diego Ruiz', 'Marcos Vidal', 'Mateo Moreno', 'Álvaro Pérez', 'Iván Castillo', 'Gabriel León', 'Javier Molina', 'Mario Sánchez', 'Sergio Ramos', 'Samuel Ortiz', 'Bruno López', 'Leo Serrano', 'David Gil', 'Carlos Muñoz', 'Jorge Cano', 'Iker Díaz', 'Eric Flores'];
    const positions = ['POR', 'DFC', 'LD', 'MCD', 'MC', 'ED', 'DC', 'EI'];
    const players = names.map((name, i) => ({ id: 'demo-' + i, event: 'demo', name, position: positions[i % 8], club: ['CD Ejemplo Norte', 'CF Ejemplo Madrid', 'AD Ejemplo Sur'][i % 3], birthyear: String(2006 + i % 5), team: i < 20 ? i % 4 + 1 : 0, attendance: i < 20 ? 'present' : i === 23 ? 'absent' : 'pending', version: 0, goals: i === 2 ? 2 : 0, number: String(i + 1), evaluation: i < 11 ? { scores: [7 + i % 3, 8, 6 + i % 4, 7] as (number | null)[], comment: 'Buen criterio con balón. Aporta intensidad y ofrece líneas de pase.', category: categories[3], version: 1 } : undefined }));
    return { role: 'admin', team: 0, event: { id: 'demo', teamCount: 4, rosterRevision: 0, teamSettings: {}, teamSettingsVersion: 0, name: 'Madrid · Talent Day', date: '', location: 'Campo de ejemplo · Madrid', status: 'live' }, events: [], players, news: [{ id: 'n1', event: 'demo', team: 3, player: 'demo-2', text: 'Lucas García lleva 2 goles. ¡Gran acierto de cara a portería!', kind: 'goal', announced: 0, created: Date.now() - 120000 }, { id: 'n2', event: 'demo', team: 1, player: 'demo-0', text: 'Álex Romero mantiene su portería a cero al finalizar el partido.', kind: 'clean', announced: 0, created: Date.now() - 360000 }], demo: true };
}
export const importFields = [['name', 'Nombre'], ['birthyear', 'Año nacimiento'], ['club', 'Equipo actual'], ['position', 'Posición'], ['phone', 'Teléfono'], ['city', 'Ciudad'], ['currentCategory', 'Categoría actual'], ['currentLeague', 'Liga actual']] as const;
export function parseCSV(input: string): string[][] {
    const src = input.replace(/^\uFEFF/, '');
    const first = src.split(/\r?\n/)[0] || '';
    const sep = first.split(';').length > first.split(',').length ? ';' : first.includes('\t') ? '\t' : ',';
    const rows: string[][] = [];
    let row: string[] = [], cell = '', quoted = false;
    for (let i = 0; i < src.length; i++) {
        const c = src[i];
        if (c === '"') {
            if (quoted && src[i + 1] === '"') {
                cell += '"';
                i++;
            }
            else
                quoted = !quoted;
        }
        else if (c === sep && !quoted) {
            row.push(cell);
            cell = '';
        }
        else if ((c === '\n' || c === '\r') && !quoted) {
            if (c === '\r' && src[i + 1] === '\n')
                i++;
            row.push(cell);
            if (row.some(x => x.trim()))
                rows.push(row);
            row = [];
            cell = '';
        }
        else
            cell += c;
    }
    if (quoted)
        throw Error('El CSV contiene comillas sin cerrar.');
    row.push(cell);
    if (row.some(x => x.trim()))
        rows.push(row);
    return rows;
}
export function autoMap(headers: string[]) { const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); const aliases: Record<string, string[]> = { name: ['nombre', 'nombre completo', 'jugador', 'name'], birthyear: ['ano nacimiento', 'ano de nacimiento', 'year'], club: ['equipo actual', 'club', 'equipo'], position: ['posicion', 'position'], phone: ['telefono', 'movil', 'phone'], city: ['ciudad', 'localidad'], currentCategory: ['categoria'], currentLeague: ['liga'] }; return Object.fromEntries(importFields.map(([key]) => [key, headers.findIndex(h => aliases[key].includes(norm(h)))])); }
export function safeCSV(rows: unknown[][]) { return '\uFEFF' + rows.map(row => row.map(v => '"' + String(v ?? '').replace(/^[=+@\-\t\r]/, "'$&").replace(/"/g, '""') + '"').join(';')).join('\r\n'); }
