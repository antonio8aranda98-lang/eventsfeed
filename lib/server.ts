import { env } from 'cloudflare:workers';
import { categories, demoState, MIN_TEAMS, MAX_TEAMS } from './model';
import { allocatePlayers } from './allocation';
const encoder = new TextEncoder();
export async function hash(s: string) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(s)))).map(x => x.toString(16).padStart(2, '0')).join(''); }
function db() { if (!env.DB)
    throw Error('Base de datos no disponible.'); return env.DB; }
const json = (value: unknown, status = 200, headers: Record<string, string> = {}) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
function fail(message: string, status = 400): never { throw Object.assign(Error(message), { status }); }
const clean = (v: unknown, max = 300) => String(v ?? '').trim().slice(0, max);
const id = () => crypto.randomUUID();
const run = async (sql: string, ...params: unknown[]) => db().prepare(sql).bind(...params).run();
const one = async (sql: string, ...params: unknown[]) => db().prepare(sql).bind(...params).first<any>();
const all = async (sql: string, ...params: unknown[]) => (await db().prepare(sql).bind(...params).all<any>()).results;
function cookie(token: string, secure: boolean, max = 43200) { return `ef_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${max}${secure ? '; Secure' : ''}`; }
async function session(req: Request) { const token = req.headers.get('cookie')?.match(/(?:^|;\s*)ef_session=([^;]+)/)?.[1]; if (!token)
    return null;
    const current = await one('SELECT * FROM sessions WHERE hash=? AND expires>?', await hash(token), Date.now());
    if (current?.role === 'coach') {
        const event = await one('SELECT team_count FROM events WHERE id=?', current.event);
        if (!event || current.team < 1 || current.team > event.team_count) return null;
    }
    return current;
}
function onlyAdmin(s: any) { if (s.role !== 'admin')
    fail('Solo Antonio puede realizar esta acción.', 403); }
async function eventAccess(s: any, event: string) { if (s.role !== 'admin' && s.event !== event)
    fail('Este acceso pertenece a otro evento.', 403); const e = await one('SELECT * FROM events WHERE id=?', event); if (!e)
    fail('Evento no encontrado.', 404); return e; }
async function playerAccess(s: any, pid: string) { const p = await one('SELECT * FROM players WHERE id=?', pid); if (!p)
    fail('Jugador no encontrado.', 404); const e = await eventAccess(s, p.event); if (e.status === 'closed')
    fail('El evento está cerrado. Antonio puede reabrirlo.', 409); if (s.role !== 'admin' && (s.role !== 'coach' || s.team !== p.team || p.attendance !== 'present'))
    fail('El jugador no está presente en tu equipo.', 403); return p; }
export async function handle(req: Request, path: string[]) { try {
    return await route(req, path);
}
catch (e: any) {
    if (!e.status)
        console.error('API failure', e.message);
    return json({ error: e.status ? e.message : 'No se ha podido completar la operación. Inténtalo de nuevo.' }, e.status || 500);
} }
async function route(req: Request, path: string[]) {
    const action = path.join('/'), url = new URL(req.url), secure = url.protocol === 'https:';
    let body: any = {};
    if (req.method !== 'GET') {
        const origin = req.headers.get('origin');
        if (origin && origin !== url.origin)
            fail('Origen no permitido.', 403);
        const raw = await req.text();
        if (raw.length > 1000000)
            fail('El archivo es demasiado grande.', 413);
        try {
            body = JSON.parse(raw || '{}');
        }
        catch {
            fail('JSON no válido.');
        }
    }
    if (action === 'demo' && req.method === 'GET')
        return json(demoState());
    if (action === 'login' && req.method === 'POST') {
        const code = clean(body.code, 200);
        if (!code)
            fail('Introduce tu código de acceso.');
        const ip = req.headers.get('cf-connecting-ip') || 'local';
        const k = await hash(ip);
        const now = Date.now();
        await run('INSERT INTO login_attempts (key,count,reset) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN reset<? THEN 1 ELSE count+1 END, reset=CASE WHEN reset<? THEN ? ELSE reset END', k, now + 60000, now, now, now + 60000);
        const a = await one('SELECT count FROM login_attempts WHERE key=?', k);
        if (a.count > 12)
            fail('Demasiados intentos. Espera un minuto.', 429);
        const password = (env as any).ADMIN_PASSWORD;
        let access: any = null;
        if (password && await hash(code) === await hash(password))
            access = { role: 'admin', event: '', team: 0 };
        else
            access = await one('SELECT * FROM access WHERE hash=?', await hash(code));
        if (!access) fail('Código incorrecto o acceso revocado.', 401);
        if (access.role === 'coach') {
            const event = await one('SELECT team_count FROM events WHERE id=?', access.event);
            if (!event || access.team < 1 || access.team > event.team_count) fail('Este equipo ya no está activo en el evento.', 401);
        }
        const token = id() + id();
        await run('INSERT INTO sessions (hash,role,event,team,expires) VALUES (?,?,?,?,?)', await hash(token), access.role, access.event, access.team, now + 43200000);
        return json({ ok: true }, 200, { 'Set-Cookie': cookie(token, secure) });
    }
    if (action === 'logout' && req.method === 'POST') {
        const s = await session(req);
        if (s)
            await run('DELETE FROM sessions WHERE hash=?', s.hash);
        return json({ ok: true }, 200, { 'Set-Cookie': cookie('', secure, 0) });
    }
    const s = await session(req);
    if (!s)
        fail('Inicia sesión para continuar.', 401);
    if (action === 'state' && req.method === 'GET') {
        const events = (s.role === 'admin' ? await all('SELECT * FROM events ORDER BY created DESC') : await all('SELECT * FROM events WHERE id=?', s.event)).map(e => ({ ...e, teamCount: e.team_count, rosterRevision: e.roster_revision }));
        const selected = url.searchParams.get('event') || events[0]?.id;
        if (!selected)
            return json({ role: s.role, team: s.team, event: null, events, players: [], news: [] });
        await eventAccess(s, selected);
        const event = events.find((e: any) => e.id === selected);
        if (!event)
            fail('Evento no encontrado.', 404);
        let players: any[] = [];
        if (s.role !== 'speaker') {
            const ps = s.role === 'admin' ? await all('SELECT * FROM players WHERE event=? ORDER BY rowid', selected) : await all('SELECT * FROM players WHERE event=? AND team=? AND attendance=? ORDER BY rowid', selected, s.team, 'present');
            const evals = s.role === 'admin' ? await all('SELECT e.* FROM evaluations e JOIN players p ON p.id=e.player WHERE p.event=?', selected) : await all('SELECT e.* FROM evaluations e JOIN players p ON p.id=e.player WHERE p.event=? AND p.team=? AND p.attendance=?', selected, s.team, 'present');
            players = ps.map(p => { const data = JSON.parse(p.data); if (s.role !== 'admin') {
                delete data.phone;
                delete data.city;
            } const ev = evals.find(e => e.player === p.id); return { ...data, id: p.id, event: p.event, team: p.team, attendance: p.attendance, version: p.version, goals: p.goals, evaluation: ev ? { ...JSON.parse(ev.data), version: ev.version, updated: ev.updated } : undefined }; });
        }
        const news = s.role === 'coach' ? await all('SELECT * FROM news WHERE event=? AND team=? ORDER BY created DESC LIMIT 300', selected, s.team) : await all('SELECT * FROM news WHERE event=? ORDER BY created DESC LIMIT 300', selected);
        return json({ role: s.role, team: s.team, event, events, players, news });
    }
    if (action === 'events' && req.method === 'POST') {
        onlyAdmin(s);
        if (!clean(body.name))
            fail('Escribe un nombre para el evento.');
        const event = id();
        await run('INSERT INTO events (id,name,date,location,status,created) VALUES (?,?,?,?,?,?)', event, clean(body.name), clean(body.date, 10), clean(body.location), 'setup', Date.now());
        return json({ id: event });
    }
    if (action === 'event' && req.method === 'POST') {
        onlyAdmin(s);
        await eventAccess(s, body.event);
        if (!['setup', 'live', 'closed'].includes(body.status))
            fail('Estado no válido.');
        await run('UPDATE events SET status=? WHERE id=?', body.status, body.event);
        return json({ ok: true });
    }
    if (action === 'organize' && req.method === 'POST') {
        onlyAdmin(s);
        const event = await eventAccess(s, body.event);
        if (event.status === 'closed') fail('Reabre el evento antes de organizar los equipos.', 409);
        const teamCount = Number(body.teamCount);
        if (!Number.isInteger(teamCount) || teamCount < MIN_TEAMS || teamCount > MAX_TEAMS) fail(`Elige entre ${MIN_TEAMS} y ${MAX_TEAMS} equipos.`);
        if (!Number.isInteger(body.revision) || body.revision !== event.roster_revision) fail('El check-in ha cambiado. Actualiza la lista y vuelve a organizar.', 409);
        const roster = await all('SELECT * FROM players WHERE event=? ORDER BY id', event.id);
        if (roster.some(player => player.attendance === 'pending')) fail('Confirma Asiste o No asiste para todos los inscritos antes de organizar.');
        let plan;
        try {
            plan = allocatePlayers(roster.map(player => ({ ...JSON.parse(player.data), id: player.id, attendance: player.attendance })), teamCount, event.id);
        } catch (error: any) { fail(error.message); }
        const assigned = new Map(plan.assignments.map(player => [player.id, player.team]));
        const guard = 'EXISTS (SELECT 1 FROM events WHERE id=? AND roster_revision=? AND status<>?)';
        const statements = roster.map(player => {
            const team = assigned.get(player.id) || 0;
            return db().prepare(`UPDATE players SET team=?,version=version+1 WHERE id=? AND event=? AND team<>? AND ${guard}`).bind(team, player.id, event.id, team, event.id, event.roster_revision, 'closed');
        });
        statements.push(db().prepare(`DELETE FROM access WHERE event=? AND role='coach' AND team>? AND ${guard}`).bind(event.id, teamCount, event.id, event.roster_revision, 'closed'));
        statements.push(db().prepare(`DELETE FROM sessions WHERE event=? AND role='coach' AND team>? AND ${guard}`).bind(event.id, teamCount, event.id, event.roster_revision, 'closed'));
        // Last statement advances the revision. A competing stale transaction changes
        // no rows: every statement shares the same precondition and D1 batch is atomic.
        statements.push(db().prepare("UPDATE events SET team_count=?,roster_revision=roster_revision+1 WHERE id=? AND roster_revision=? AND status<>'closed'").bind(teamCount, event.id, event.roster_revision));
        const result = await db().batch(statements);
        if (!result[result.length - 1].meta.changes) fail('La lista o el estado del evento ha cambiado durante el reparto. Actualiza y vuelve a intentarlo.', 409);
        return json({ ...plan, revision: event.roster_revision + 1 });
    }
    if (action === 'access' && req.method === 'POST') {
        onlyAdmin(s);
        const event = await eventAccess(s, body.event);
        const team = Number(body.team), role = team ? 'coach' : 'speaker';
        if (team < 0 || team > event.team_count || !Number.isInteger(team))
            fail('Equipo no válido.');
        const code = Array.from(crypto.getRandomValues(new Uint8Array(10))).map(n => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[n % 32]).join('');
        const results = await db().batch([
            db().prepare('DELETE FROM access WHERE event=? AND role=? AND team=?').bind(body.event, role, team),
            db().prepare('DELETE FROM sessions WHERE event=? AND role=? AND team=?').bind(body.event, role, team),
            db().prepare('INSERT INTO access (id,event,role,team,hash) SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM events WHERE id=? AND team_count>=?)').bind(id(), body.event, role, team, await hash(code), body.event, team),
        ]);
        if (!results[2].meta.changes) fail('El número de equipos ha cambiado. Actualiza antes de generar el acceso.', 409);
        return json({ code, role, team });
    }
    if (action === 'sheet' && req.method === 'POST') {
        onlyAdmin(s);
        let link: URL;
        try {
            link = new URL(body.url);
        }
        catch {
            fail('Enlace no válido.');
        }
        if (link!.hostname !== 'docs.google.com')
            fail('Usa un enlace de Google Sheets.');
        const sid = link!.pathname.match(/^\/spreadsheets\/d\/([A-Za-z0-9_-]+)\//)?.[1];
        if (!sid)
            fail('Enlace de hoja no válido.');
        const gid = new URLSearchParams(link!.hash.slice(1)).get('gid') || link!.searchParams.get('gid') || '';
        const response = await fetch(`https://docs.google.com/spreadsheets/d/${sid}/export?format=csv${gid ? '&gid=' + encodeURIComponent(gid) : ''}`, { redirect: 'follow' });
        const csv = await response.text();
        if (!response.ok || csv.trim().startsWith('<') || csv.length > 900000)
            fail('No se puede leer esta hoja desde la web. Descárgala como CSV en Google Sheets y súbela aquí; no hace falta cambiar sus permisos.');
        return json({ csv });
    }
    if (action === 'import' && req.method === 'POST') {
        onlyAdmin(s);
        const ev = await eventAccess(s, body.event);
        if (ev.status === 'closed')
            fail('Reabre el evento antes de importar.');
        if (!Array.isArray(body.players) || !body.players.length || body.players.length > 300)
            fail('Importa entre 1 y 300 jugadores.');
        const existing = await all('SELECT data FROM players WHERE event=?', body.event);
        const key = (p: any) => clean(p.name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() + '|' + clean(p.birthyear);
        const seen = new Set(existing.map(x => key(JSON.parse(x.data))));
        const rows: any[] = [];
        let skipped = 0;
        for (const p of body.players) {
            if (!clean(p.name))
                continue;
            if (seen.has(key(p))) {
                skipped++;
                continue;
            }
            seen.add(key(p));
            const data = Object.fromEntries(['name', 'birthyear', 'club', 'position', 'phone', 'city', 'currentCategory', 'currentLeague', 'number'].map(k => [k, clean(p[k], k === 'name' ? 180 : 120)]));
            rows.push(db().prepare('INSERT INTO players (id,event,team,attendance,data,version,goals) VALUES (?,?,0,?,?,0,0)').bind(id(), body.event, 'pending', JSON.stringify(data)));
        }
        for (let i = 0; i < rows.length; i += 75)
            await db().batch([...rows.slice(i, i + 75), db().prepare('UPDATE events SET roster_revision=roster_revision+1 WHERE id=?').bind(body.event)]);
        return json({ added: rows.length, skipped });
    }
    if (action === 'player' && req.method === 'POST') {
        const p = await playerAccess(s, body.id);
        const event = await eventAccess(s, p.event);
        const old = JSON.parse(p.data);
        const data = { ...old };
        const fields = s.role === 'admin' ? ['name', 'birthyear', 'club', 'position', 'phone', 'city', 'currentCategory', 'currentLeague', 'number'] : ['position', 'number'];
        for (const field of fields)
            if (field in body)
                data[field] = clean(body[field], 180);
        if (!data.name)
            fail('El nombre es obligatorio.');
        const team = s.role === 'admin' && body.team !== undefined ? Number(body.team) : p.team;
        const attendance = s.role === 'admin' && body.attendance !== undefined ? body.attendance : p.attendance;
        if (!Number.isInteger(team) || team < 0 || team > event.team_count || !['present', 'absent', 'pending'].includes(attendance))
            fail('Equipo o asistencia no válido.');
        const results = await db().batch([
            db().prepare("UPDATE players SET data=?,team=?,attendance=?,version=version+1 WHERE id=? AND version=? AND EXISTS (SELECT 1 FROM events WHERE id=? AND team_count>=? AND status<>'closed')").bind(JSON.stringify(data), team, attendance, p.id, body.version, p.event, team),
            db().prepare('UPDATE events SET roster_revision=roster_revision+1 WHERE id=?').bind(p.event),
        ]);
        const result = results[0];
        if (!result.meta.changes)
            fail('Otro dispositivo ha cambiado esta ficha. Actualiza y vuelve a intentarlo.', 409);
        return json({ ok: true });
    }
    if (action === 'evaluation' && req.method === 'POST') {
        const p = await playerAccess(s, body.id);
        const scores = body.scores;
        if (!Array.isArray(scores) || scores.length !== 4 || scores.some((n: any) => n !== null && (!Number.isInteger(n) || n < 1 || n > 10)))
            fail('Puntúa cada apartado del 1 al 10.');
        if (body.category && !categories.includes(body.category))
            fail('Categoría no válida.');
        const data = JSON.stringify({ scores, comment: clean(body.comment, 6000), category: clean(body.category) });
        const version = Number(body.version) || 0;
        const existing = await one('SELECT version FROM evaluations WHERE player=?', p.id);
        const scope = s.role === 'admin' ? '' : ' AND team=' + Number(s.team) + ' AND attendance=\'present\'';
        let result;
        if (!existing) {
            if (version !== 0)
                fail('La valoración ha cambiado.', 409);
            result = await run(`INSERT INTO evaluations (player,data,version,updated,author) SELECT id,?,1,?,? FROM players WHERE id=?${scope} ON CONFLICT(player) DO NOTHING`, data, Date.now(), s.role, p.id);
        }
        else
            result = await run(`UPDATE evaluations SET data=?,version=version+1,updated=?,author=? WHERE player=? AND version=? AND EXISTS (SELECT 1 FROM players WHERE id=?${scope})`, data, Date.now(), s.role, p.id, version, p.id);
        if (!result.meta.changes)
            fail('La valoración o el equipo ha cambiado. Cierra la ficha y ábrela de nuevo para revisar la versión actual.', 409);
        return json({ ok: true });
    }
    if (action === 'news' && req.method === 'POST') {
        const p = body.player ? await playerAccess(s, body.player) : null;
        const e = await eventAccess(s, body.event);
        if (e.status === 'closed')
            fail('El evento está cerrado.', 409);
        if (s.role === 'speaker')
            fail('El speaker solo puede marcar noticias como anunciadas.', 403);
        if (!p && s.role !== 'admin')
            fail('Selecciona un jugador de tu equipo.', 403);
        if (p && p.event !== body.event)
            fail('Jugador de otro evento.');
        const kind = ['goal', 'clean', 'note'].includes(body.kind) ? body.kind : 'note';
        const nid = clean(body.requestId, 80) || id();
        const team = p?.team || 0;
        const name = p ? JSON.parse(p.data).name : '';
        const text = kind === 'goal' ? `${name} ha marcado un gol.` : kind === 'clean' ? `${name} ha terminado el partido con la portería a cero.` : clean(body.text, 1400);
        if (!text)
            fail('Escribe la noticia.');
        const duplicate = await one('SELECT id FROM news WHERE id=?', nid);
        if (duplicate)
            return json({ ok: true });
        const insert = db().prepare('INSERT INTO news (id,event,team,player,text,kind,announced,created) VALUES (?,?,?,?,?,?,0,?)').bind(nid, body.event, team, p?.id || null, text, kind, Date.now());
        if (kind === 'goal' && p)
            await db().batch([insert, db().prepare('UPDATE players SET goals=goals+1,version=version+1 WHERE id=?').bind(p.id)]);
        else
            await insert.run();
        return json({ ok: true });
    }
    if (action === 'announce' && req.method === 'POST') {
        if (!['admin', 'speaker'].includes(s.role))
            fail('Acceso restringido al speaker.', 403);
        const n = await one('SELECT * FROM news WHERE id=?', body.id);
        if (!n)
            fail('Noticia no encontrada.', 404);
        await eventAccess(s, n.event);
        await run('UPDATE news SET announced=? WHERE id=?', body.announced ? 1 : 0, n.id);
        return json({ ok: true });
    }
    fail('Ruta no encontrada.', 404);
}
