'use client';
import { useEffect, useState, useCallback } from 'react';
import FormationBoard from './components/FormationBoard';
import TeamOrganizer from './components/TeamOrganizer';
import TeamEditor from './components/TeamEditor';
import { allocatePlayers } from '@/lib/allocation';
import { Activity, ArrowDownToLine, ArrowLeft, ArrowRight, Check, CheckCheck, ChevronRight, CircleHelp, ClipboardList, Copy, DoorOpen, ExternalLink, FileSpreadsheet, Flag, Goal, LayoutDashboard, ListFilter, LoaderCircle, LockKeyhole, Megaphone, MoreHorizontal, Plus, Radio, Search, Settings2, ShieldCheck, SlidersHorizontal, Sparkles, Trophy, Upload, Users, Wifi, WifiOff, X } from 'lucide-react';
import { categories, teams, eventTeams, teamAppearance, teamInk, mergeTeamSettings, metrics, demoState, importFields, parseCSV, autoMap, safeCSV, type State, type Player, type Evaluation, type EventTeam } from '@/lib/model';
const empty: Evaluation = { scores: [null, null, null, null], comment: '', category: '', version: 0 };
async function api(path: string, body?: unknown) { const r = await fetch('/api/' + path, { method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' }); const d: any = await r.json(); if (!r.ok)
    throw Object.assign(Error(d.error || 'Error de conexión'), { status: r.status }); return d; }
function average(p: Player) { const a = p.evaluation?.scores.filter((n): n is number => n !== null) || []; return a.length ? (a.reduce((s, n) => s + n, 0) / a.length).toFixed(1) : '—'; }
function initials(s: string) { return s.split(' ').slice(0, 2).map(n => n[0]).join(''); }
function TeamDot({ color }: { color: string }) { return <span className="team-dot" style={{ background: color }}/>; }
export default function Home() {
    const [state, setState] = useState<State | null>(null), [loading, setLoading] = useState(true), [demo, setDemo] = useState(false), [code, setCode] = useState(''), [loginError, setLoginError] = useState(''), [busy, setBusy] = useState(false);
    const [view, setView] = useState('overview'), [selectedEvent, setSelectedEvent] = useState(''), [search, setSearch] = useState(''), [filter, setFilter] = useState('all'), [teamFilter, setTeamFilter] = useState(0), [modal, setModal] = useState(''), [player, setPlayer] = useState<Player | null>(null), [toast, setToast] = useState(''), [offline, setOffline] = useState(false), [lastSync, setLastSync] = useState<Date | null>(null);
    const [pinAccess, setPinAccess] = useState(true);
    const notify = (s: string) => { setToast(s); setTimeout(() => setToast(''), 5000); };
    const refresh = useCallback(async () => { if (demo)
        return; try {
        const d = await api('state' + (selectedEvent ? '?event=' + selectedEvent : ''));
        setState(d);
        setOffline(false);
        setLastSync(new Date());
        if (d.role === 'coach')
            setView(v => v === 'overview' ? 'teams' : v);
        if (d.role === 'speaker')
            setView('speaker');
    }
    catch (e: any) {
        if (e.status === 401)
            setState(null);
        else
            setOffline(true);
    }
    finally {
        setLoading(false);
    } }, [selectedEvent, demo]);
    useEffect(() => { refresh(); const t = setInterval(refresh, 3000); return () => clearInterval(t); }, [refresh]);
    const act = async (path: string, body: any) => { if (demo) {
        notify('Vista de ejemplo · Inicia sesión para guardar cambios.');
        return false;
    } setBusy(true); try {
        await api(path, body);
        await refresh();
        return true;
    }
    catch (e: any) {
        notify(e.message);
        return false;
    }
    finally {
        setBusy(false);
    } };
    async function login(e: React.FormEvent) { e.preventDefault(); setBusy(true); setLoginError(''); try {
        await api('login', { code: code.trim() });
        setDemo(false);
        setCode('');
        await refresh();
    }
    catch (e: any) {
        setLoginError(e.message);
    }
    finally {
        setBusy(false);
    } }
    function openDemo() { setDemo(true); setState(demoState()); setLoading(false); setView('overview'); }
    function selectView(v: string) { setView(v); setSearch(''); setFilter('all'); window.scrollTo({ top: 0 }); }
    const admin = state?.role === 'admin', coach = state?.role === 'coach';
    const players = state?.players || [];
    const teamSettings = state?.event?.teamSettings || {};
    const availableTeams = eventTeams(state?.event?.teamCount, teamSettings);
    const teamName = (id: number) => teamAppearance(id, teamSettings).name;
    const teamColor = (id: number) => teamAppearance(id, teamSettings).color;
    const validTeamFilter = teamFilter <= availableTeams.length ? teamFilter : 0;
    const displayedTeam = view === 'teams' ? (coach ? state?.team || 1 : validTeamFilter || 1) : validTeamFilter;
    const present = players.filter(p => p.attendance === 'present');
    const evaluated = present.filter(p => p.evaluation && p.evaluation.scores.every(n => n !== null) && p.evaluation.category);
    const pendingNews = state?.news.filter(n => !n.announced) || [];
    let filtered = players.filter(p => (p.name + ' ' + p.club + ' ' + p.position + ' ' + (p.number || '')).toLowerCase().includes(search.toLowerCase()));
    if (displayedTeam)
        filtered = filtered.filter(p => p.team === displayedTeam);
    if (filter === 'present' || filter === 'pending' || filter === 'absent')
        filtered = filtered.filter(p => p.attendance === filter);
    if (filter === 'evaluated')
        filtered = filtered.filter(p => p.evaluation);
    if (filter === 'unevaluated')
        filtered = filtered.filter(p => !p.evaluation);
    async function organizeTeams(count: number, closeCheckin = false) {
        if (!state?.event) throw Error('Selecciona un evento.');
        setBusy(true);
        try {
            if (demo) {
                const plan = allocatePlayers(state.players, count, state.event.id);
                const assignments = new Map(plan.assignments.map(player => [player.id, player.team]));
                const revision = state.event.rosterRevision + 1;
                setState({ ...state, event: { ...state.event, teamCount: count, rosterRevision: revision }, players: state.players.map(player => ({ ...player, attendance: closeCheckin && player.attendance === 'pending' ? 'absent' : player.attendance, team: assignments.get(player.id) || 0, version: player.version + 1 })) });
                setTeamFilter(0);
                return { ...plan, revision, closedPending: closeCheckin ? state.players.filter(player => player.attendance === 'pending').length : 0 };
            }
            const response = await api('organize', { event: state.event.id, teamCount: count, revision: state.event.rosterRevision, closeCheckin });
            setTeamFilter(0);
            await refresh();
            return response;
        } catch (error: any) {
            if (error.status === 409) await refresh();
            throw error;
        } finally { setBusy(false); }
    }
    async function saveTeamSettings(changes: EventTeam[], version: number) {
        if (!state?.event) throw Error('Selecciona un evento.');
        if (demo) {
            setState({ ...state, event: { ...state.event, teamSettings: mergeTeamSettings(teamSettings, changes, state.event.teamCount), teamSettingsVersion: version + 1 } });
        } else {
            setBusy(true);
            try { await api('team-settings', { event: state.event.id, version, teams: changes }); await refresh(); }
            catch (error: any) { if (error.status === 409) await refresh(); throw error; }
            finally { setBusy(false); }
        }
        setModal('');
        notify(demo ? 'Nombres y colores actualizados en este ejemplo.' : 'Nombres y colores guardados para este evento.');
    }
    function exportResults() { if (!state)
        return; const rows = [['Nombre', 'Año nacimiento', 'Equipo actual', 'Posición', 'Teléfono', 'Asistencia', 'Equipo evento', 'Dorsal', 'Físico', 'Imagen', 'Técnico', 'Táctico', 'Categoría recomendada', 'Comentarios', 'Goles'], ...players.map(p => [p.name, p.birthyear, p.club, p.position, p.phone, p.attendance === 'present' ? 'Asiste' : p.attendance === 'absent' ? 'No asiste' : 'Pendiente', teamName(p.team), p.number, ...(p.evaluation?.scores || [null, null, null, null]), p.evaluation?.category, p.evaluation?.comment, p.goals])]; const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([safeCSV(rows)], { type: 'text/csv;charset=utf-8' })); a.download = 'eventsfeed-resultados.csv'; a.click(); URL.revokeObjectURL(a.href); }
    if (loading)
        return <main className="loading"><img className="brandmark" src="/icons/eventsfeed-mark-v3.svg" width={35} height={35} alt=""/><LoaderCircle className="spin"/><p>Preparando el campo…</p></main>;
    if (!state)
        return <main className="login-page"><div className="login-art"><div className="brand light"><img className="brandmark" src="/icons/eventsfeed-mark-v3.svg" width={35} height={35} alt=""/>eventsfeed<span className="brand-period">.</span></div><div className="login-copy"><span className="eyebrow light">EL TALENTO SE VE EN EL CAMPO</span><h1>Tu evento.<br />Todo en juego.</h1><p>Del primer check-in a la última valoración.<br />Tu equipo conectado, en cada momento.</p></div><div className="pitch"><div className="pitch-box"/><div className="pitch-center"/><div className="pitch-ball"/><div className="pitch-caption"><Radio size={16}/> UN SOLO CAMPO. TODOS CONECTADOS.</div></div><div className="login-foot">EVENT OPERATIONS FOR FOOTBALL PEOPLE <span>EN EL CAMPO</span></div></div><section className="login-panel"><div className="login-panel-inner"><span className="tiny-pill"><ShieldCheck size={14}/> ACCESO DEL EQUIPO</span><h2>Nos vemos en el campo.</h2><p>{pinAccess ? 'Introduce el PIN de 4 cifras de tu equipo o del speaker.' : 'Introduce tu código habitual de Antonio o un código anterior.'}</p><div className="login-access-options" role="group" aria-label="Tipo de acceso"><button type="button" aria-pressed={pinAccess} className={pinAccess ? 'selected' : ''} onClick={() => { setPinAccess(true); setCode(''); setLoginError(''); }}>PIN del equipo</button><button type="button" aria-pressed={!pinAccess} className={!pinAccess ? 'selected' : ''} onClick={() => { setPinAccess(false); setCode(''); setLoginError(''); }}>Antonio / otro código</button></div><form onSubmit={login}><label htmlFor="code">{pinAccess ? 'PIN de 4 cifras' : 'Código de acceso'}</label><div className="input-icon"><LockKeyhole size={18}/><input id="code" type="password" inputMode={pinAccess ? "numeric" : "text"} pattern={pinAccess ? "[0-9]{4}" : undefined} minLength={pinAccess ? 4 : undefined} maxLength={pinAccess ? 4 : 200} autoComplete="current-password" value={code} onChange={e => setCode(pinAccess ? e.target.value.replace(/\D/g, "").slice(0, 4) : e.target.value)} placeholder={pinAccess ? "4 cifras" : "Tu código de acceso"} required/></div>{loginError && <p className="error" role="alert">{loginError}</p>}<button className="btn primary full" disabled={busy}>{busy ? <LoaderCircle className="spin" size={18}/> : <>Entrar al evento <ArrowRight size={18}/></>}</button></form><div className="login-divider"><span>¿Quieres conocer Eventsfeed?</span></div><button className="btn ghost full" onClick={openDemo}>Explorar evento de ejemplo <ArrowUpRight /></button><p className="login-note"><LockKeyhole size={13}/> Los datos y las valoraciones tienen acceso restringido.</p></div><footer>EVENTSFEED <span>El siguiente talento empieza aquí.</span></footer></section></main>;
    return <div className="app-shell"><aside className="sidebar"><a className="brand" href="/" onClick={e => { e.preventDefault(); selectView('overview'); }}><img className="brandmark" src="/icons/eventsfeed-mark-v3.svg" width={35} height={35} alt=""/>eventsfeed<span className="brand-period">.</span></a><div className="workspace-label">ESPACIO DE EVENTOS</div><div className="event-switch"><span className="event-emblem"><Flag size={19}/></span><div><strong>{state.event?.name || 'Tu primer evento'}</strong><small>{demo ? 'Vista de ejemplo' : 'Centro de operaciones'}</small></div></div><div className="workspace-label nav-label">EN EL CAMPO</div><nav>{(admin ? [['overview', 'Vista general', LayoutDashboard], ['checkin', 'Check-in', CheckCheck], ['teams', 'Equipos', Users], ['evaluations', 'Valoraciones', ClipboardList], ['speaker', 'Speaker', Megaphone]] : coach ? [['teams', 'Mi equipo', Users], ['evaluations', 'Valoraciones', ClipboardList], ['speaker', 'Mis noticias', Megaphone]] : [['speaker', 'Speaker', Megaphone]]).map(([key, label, Icon]: any) => <button key={key} className={view === key ? 'active' : ''} onClick={() => selectView(key)}><Icon size={19}/>{label}{key === 'speaker' && pendingNews.length > 0 && <span className="nav-count">{pendingNews.length}</span>}</button>)}</nav><div className="sidebar-bottom"><div className="tablet-note"><div className="mini-pitch"><span /></div><strong>Un equipo. Una conexión.</strong><p>Todo lo que pasa en el campo,<br />en el mismo lugar.</p></div>{admin && <button className="sidebar-action" onClick={() => setModal('access')}><Settings2 size={17}/> Accesos de las tablets</button>}<button className="profile" onClick={async () => { if (demo) {
        setDemo(false);
        setState(null);
        setSelectedEvent('');
    }
    else {
        await api('logout', {});
        setState(null);
        setSelectedEvent('');
    } setView('overview'); }}><span className="avatar">{admin ? 'A' : coach ? state.team : 'S'}</span><span><strong>{demo ? 'Antonio · Ejemplo' : admin ? 'Antonio' : coach ? teamName(state.team) : 'Speaker'}</strong><small>{demo ? 'Salir del ejemplo' : admin ? 'Administrador' : 'Acceso del evento'}</small></span><DoorOpen size={17}/></button></div></aside>
 <div className="main-shell"><header className="topbar"><div className="breadcrumb">Eventos <ChevronRight size={14}/><strong>{state.event?.name || 'Nuevo evento'}</strong></div><div className="topbar-right">{admin && <button className="icon-btn" aria-label="Accesos de las tablets" onClick={() => setModal('access')}><Settings2 size={16}/></button>}<span className={'connection ' + (offline ? 'is-offline' : '')}>{offline ? <WifiOff size={14}/> : <span className="live-dot"/>}{demo ? 'Modo ejemplo' : offline ? 'Sin conexión' : lastSync ? 'Sincronizado · cada 3 s' : 'Conectando'}</span><button className="icon-btn" aria-label="Cerrar sesión" onClick={async () => { if (!demo)
        await api('logout', {}); setDemo(false); setState(null); setSelectedEvent(''); setView('overview'); }}><DoorOpen size={16}/></button>{admin && <button className="btn small" onClick={() => setModal('event')}><Plus size={16}/> Nuevo evento</button>}</div></header>
 {demo && <div className="demo-banner"><Sparkles size={15}/><span>Estás explorando un evento ficticio. El reparto de ejemplo se puede probar sin guardar datos.</span><button onClick={() => { setDemo(false); setState(null); }}>Entrar con mi código <ArrowRight size={14}/></button></div>}
 {offline && <div className="offline-banner" role="alert">Sin conexión con el servidor. La información puede estar desactualizada. Tus formularios abiertos se conservan; espera a recuperar la conexión para guardar.</div>}
 <main className="content"><div className="page-heading"><div><span className="eyebrow">{view === 'overview' ? 'CENTRO DE OPERACIONES' : view === 'speaker' ? 'LA VOZ DEL EVENTO' : view === 'checkin' ? 'CADA JUGADOR CUENTA' : view === 'teams' ? 'TUS EQUIPOS. UN MISMO CAMPO.' : 'OBSERVAR. VALORAR. DESCUBRIR.'}</span><h1>{{ overview: 'Todo listo para el talento.', checkin: 'Bienvenidos al campo.', teams: coach ? 'Tu equipo, de cerca.' : 'El talento toma equipo.', evaluations: 'Más allá del resultado.', speaker: 'Lo que pasa, se cuenta.' }[view]}</h1><p>{{ overview: 'Un vistazo al evento. El control de cada detalle.', checkin: 'Marca a quienes han venido y cierra el check-in para organizar los equipos.', teams: 'Cada jugador en su sitio. Cada entrenador conectado.', evaluations: 'Comentarios y criterio para descubrir el siguiente paso.', speaker: 'Noticias del campo, listas para salir por megafonía.' }[view]}</p></div><div className="heading-actions">{admin && state.events.length > 0 && <select aria-label="Evento" value={state.event?.id} onChange={e => { setSelectedEvent(e.target.value); setPlayer(null); setTeamFilter(0); }}>{demo ? <option>Evento de ejemplo</option> : state.events.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select>}{admin && (view === 'checkin' || view === 'overview') && <button className="btn primary" onClick={() => setModal('import')} disabled={!state.event}><Upload size={17}/> Importar jugadores</button>}{admin && view === 'teams' && <button className="btn primary" disabled={!state.event || busy} onClick={() => setModal('teams')}><Settings2 size={17}/> Editar equipos</button>}{admin && view === 'evaluations' && <button className="btn" onClick={exportResults}><ArrowDownToLine size={17}/> Exportar CSV</button>}</div></div>
 {!state.event ? <div className="empty-panel"><div className="empty-icon"><Flag size={32}/></div><h2>El próximo evento empieza aquí.</h2><p>Crea un evento, importa tus inscritos y prepara los accesos de los entrenadores.</p><button className="btn primary" onClick={() => setModal('event')}><Plus size={18}/> Crear mi primer evento</button></div> : <>
 {view === 'overview' && <><div className="hero-event"><div><span className="hero-kicker"><span className="live-dot"/>{state.event.status === 'live' ? 'EVENTO EN JUEGO' : state.event.status === 'closed' ? 'EVENTO CERRADO' : 'PREPARANDO EL EVENTO'}</span><h2>{state.event.name}</h2><p><Flag size={15}/>{state.event.location || 'Ubicación por confirmar'}<span>·</span>{state.event.date ? new Date(state.event.date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Fecha por confirmar'}</p><button onClick={() => selectView('checkin')}>Ir al check-in <ArrowRight size={16}/></button></div><div className="hero-pitch" aria-hidden="true"><div /><span /><i /></div><span className="hero-number">EL JUEGO<br />EMPIEZA AQUÍ.</span></div>
 <div className="stat-grid"><Stat title="JUGADORES INSCRITOS" value={players.length} foot="Talento por descubrir" icon={<Users size={18}/>}/><Stat title="YA EN EL CAMPO" value={present.length} foot={`${players.filter(p => p.attendance === 'pending').length} pendientes de check-in`} icon={<CheckCheck size={18}/>} progress={players.length ? present.length / players.length : 0}/><Stat title="VALORACIONES COMPLETAS" value={evaluated.length} suffix={'/ ' + present.length} foot="4 notas y categoría recomendada" icon={<ClipboardList size={18}/>} progress={present.length ? evaluated.length / present.length : 0}/><Stat title="NOTICIAS PARA EL SPEAKER" value={pendingNews.length} foot="Pendientes de anunciar" icon={<Megaphone size={18}/>}/></div>
 <div className="section-title"><div><h2>El campo, por equipos <span className="count-badge">{String(availableTeams.length).padStart(2, '0')}</span></h2><p>Una tablet por equipo. Todos en la misma página.</p></div><button className="text-btn" onClick={() => selectView('teams')}>Ver equipos <ArrowRight size={15}/></button></div><div className="team-grid">{availableTeams.map(t => <TeamCard key={t.id} team={t} players={present.filter(p => p.team === t.id)} onClick={() => { setTeamFilter(t.id); selectView('teams'); }}/>)}</div>
 <div className="overview-bottom"><section className="panel"><div className="panel-heading"><h2><Radio size={18}/> Últimas noticias del campo</h2><button className="text-btn" onClick={() => selectView('speaker')}>Ver todas <ArrowRight size={14}/></button></div>{state.news.length ? state.news.slice(0, 3).map(n => <div className="mini-news" key={n.id}><span className={'news-icon ' + n.kind}>{n.kind === 'goal' ? <Goal size={19}/> : <Megaphone size={18}/>}</span><div><p>{n.text}</p><small><TeamDot color={teamColor(n.team)}/>{teamName(n.team)} · {new Date(n.created).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</small></div><span className={'status-tag ' + (n.announced ? 'muted' : 'orange')}>{n.announced ? 'Anunciada' : 'Por anunciar'}</span></div>) : <div className="small-empty">Las noticias de los entrenadores aparecerán aquí.</div>}</section><section className="panel checklist"><span className="eyebrow">A PIE DE CAMPO</span><h2>Que nada se quede fuera.</h2>{[['Importa la lista de inscritos', players.length > 0], ['Confirma y reparte los equipos', present.length > 0 && present.every(p => p.team > 0)], ['Comparte el acceso a las tablets', false]].map(([label, done], i) => <button key={i} onClick={() => i === 0 ? setModal('import') : i === 1 ? selectView('checkin') : setModal('access')}><span className={done ? 'done' : ''}>{done ? <Check size={12}/> : i + 1}</span>{label}<ChevronRight size={14}/></button>)}<p><Wifi size={14}/> Necesitáis conexión a internet en el campo.</p></section></div></>}
 {view === 'teams' && <><div className="team-grid">{availableTeams.filter(t => !coach || t.id === state.team).map(t => <TeamCard key={t.id} team={t} players={present.filter(p => p.team === t.id)} active={displayedTeam === t.id} onClick={() => setTeamFilter(t.id)}/>)}</div><FormationBoard players={players} team={displayedTeam} settings={teamSettings} onPlayer={setPlayer}/><div className="section-title"><div><h2>{teamName(displayedTeam)}</h2><p>Abre una ficha para valorar y enviar noticias al speaker.</p></div>{admin && <button className="text-btn" onClick={() => selectView('checkin')}>Gestionar asignaciones <ArrowRight size={15}/></button>}</div></>}
 {view === 'checkin' && admin && <TeamOrganizer event={state.event} players={players} busy={busy} demo={demo} onOrganize={organizeTeams}/>}
 {(view === 'checkin' || view === 'teams' || view === 'evaluations') && <section className="panel player-panel"><div className="table-toolbar"><div className="search-input"><Search size={17}/><input aria-label="Buscar jugadores" placeholder="Buscar jugador, posición, club…" value={search} onChange={e => setSearch(e.target.value)}/></div><div className="filter-group"><select aria-label="Filtrar estado" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">Todos los estados</option><option value="pending">Check-in pendiente</option><option value="present">Asisten</option><option value="absent">No asisten</option><option value="evaluated">Con valoración</option><option value="unevaluated">Sin valoración</option></select>{admin && <select aria-label="Filtrar equipo" value={displayedTeam} onChange={e => setTeamFilter(Number(e.target.value))}>{view !== 'teams' && <option value={0}>Todos los equipos</option>}{availableTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>}<span className="table-count">{filtered.length} jugadores</span></div></div><div className="table-scroll"><table><thead><tr><th>JUGADOR</th><th>POSICIÓN</th><th>{view === 'checkin' ? 'ASISTENCIA' : 'EQUIPO'}</th><th>{view === 'checkin' ? 'EQUIPO' : 'VALORACIÓN'}</th><th>{view === 'checkin' ? '' : 'CATEGORÍA RECOMENDADA'}</th><th /></tr></thead><tbody>{filtered.map(p => <tr key={p.id}><td><button className="player-name" onClick={() => setPlayer(p)}><span className="player-avatar" style={{ background: teamColor(p.team) + '17' }}>{p.number || initials(p.name)}</span><span><strong>{p.name}</strong><small>{p.club || 'Club sin indicar'}{p.birthyear ? ' · ' + p.birthyear : ''}</small></span></button></td><td><span className="position-tag">{p.position || '—'}</span></td><td>{view === 'checkin' ? <select className={'attendance-select ' + p.attendance} aria-label={'Asistencia de ' + p.name} value={p.attendance} disabled={busy || demo} onChange={e => act('player', { id: p.id, version: p.version, attendance: e.target.value })}><option value="pending">Pendiente</option><option value="present">✓ Asiste</option><option value="absent">No asiste</option></select> : <span className="team-label"><TeamDot color={teamColor(p.team)}/>{teamName(p.team)}</span>}</td><td>{view === 'checkin' ? <select aria-label={'Equipo de ' + p.name} value={p.team} disabled={busy || demo} onChange={e => act('player', { id: p.id, version: p.version, team: Number(e.target.value) })}><option value={0}>Sin asignar</option>{availableTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select> : <span className={'score-tag ' + (p.evaluation ? 'rated' : '')}>{p.evaluation ? <><span>{average(p)}</span> / 10</> : 'Sin valorar'}</span>}</td><td>{view === 'checkin' ? <span className="subtle">{p.phone || 'Sin teléfono'}</span> : <span className="category-cell">{p.evaluation?.category || '—'}</span>}</td><td><button className="icon-btn" aria-label={'Abrir ficha de ' + p.name} onClick={() => setPlayer(p)}><ChevronRight size={18}/></button></td></tr>)}</tbody></table></div>{filtered.length === 0 && <div className="small-empty"><Users size={28}/><h3>{players.length ? 'Ningún jugador coincide.' : 'El equipo empieza con su lista.'}</h3><p>{players.length ? 'Prueba otros filtros o busca por nombre.' : 'Importa el CSV de inscritos o añade jugadores manualmente.'}</p>{admin && <button className="btn primary" onClick={() => setModal('add')}><Plus size={16}/> Añadir jugador</button>}</div>}<div className="table-footer"><span>{filtered.length} de {players.length} jugadores</span>{admin && <button className="text-btn" onClick={() => setModal('add')}><Plus size={14}/> Añadir jugador</button>}</div></section>}
 {view === 'speaker' && <><div className="speaker-header"><div className="speaker-signal"><Radio size={22}/></div><div><h2>{pendingNews.length} noticias por anunciar</h2><p>{coach ? 'Envía una noticia desde la ficha de un jugador.' : 'Las noticias llegan desde las tablets de los entrenadores.'}</p></div>{admin && <button className="btn primary" onClick={() => setModal('news')}><Plus size={17}/> Nueva noticia</button>}</div><div className="speaker-filters"><button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Por anunciar <span>{pendingNews.length}</span></button><button className={filter === 'announced' ? 'active' : ''} onClick={() => setFilter('announced')}>Anunciadas <span>{state.news.length - pendingNews.length}</span></button></div><div className="news-list">{state.news.filter(n => filter === 'announced' ? n.announced : !n.announced).map(n => <article className="news-card" key={n.id}><span className={'news-icon large ' + n.kind}>{n.kind === 'goal' ? <Goal size={27}/> : n.kind === 'clean' ? <ShieldCheck size={27}/> : <Megaphone size={27}/>}</span><div className="news-copy"><div><span className="team-label"><TeamDot color={teamColor(n.team)}/>{teamName(n.team)}</span><time>{new Date(n.created).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</time></div><h3>{n.text}</h3><small>{n.kind === 'goal' ? 'GOL' : n.kind === 'clean' ? 'PORTERÍA A CERO' : 'DESDE EL CAMPO'}</small></div>{!coach && <button className={'btn ' + (n.announced ? '' : 'primary')} disabled={busy || demo} onClick={() => act('announce', { id: n.id, announced: !n.announced })}>{n.announced ? <><ArrowLeft size={16}/> Devolver a pendientes</> : <><Check size={17}/> Ya anunciada</>}</button>}</article>)}{state.news.filter(n => filter === 'announced' ? n.announced : !n.announced).length === 0 && <div className="empty-panel"><Megaphone size={36}/><h2>{filter === 'announced' ? 'Aún no hay noticias anunciadas.' : 'Todo al día, micrófono listo.'}</h2><p>Las nuevas noticias aparecerán aquí automáticamente.</p></div>}</div></>}
 {admin && <footer className="content-footer"><span><span className="live-dot"/> EVENTSFEED · EL TALENTO, CONECTADO.</span><div>Estado del evento <select aria-label="Estado del evento" value={state.event.status} disabled={demo || busy} onChange={e => act('event', { event: state.event!.id, status: e.target.value })}><option value="setup">Preparación</option><option value="live">En juego</option><option value="closed">Cerrado</option></select></div></footer>}</>}
 </main></div>
 {player && <PlayerModal player={player} teamLabel={teamName(player.team)} admin={!!admin} demo={demo} busy={busy} onClose={() => setPlayer(null)} onSave={async (body: any) => { const ok = await act('evaluation', body); if (ok) {
        setPlayer(null);
        notify('Valoración guardada. Ya está disponible para Antonio.');
    } }} onDetails={async (body: any) => { const ok = await act('player', body); if (ok) {
        setPlayer(null);
        notify('Ficha actualizada.');
    } }} onNews={async (body: any) => { const ok = await act('news', { ...body, event: state.event!.id, player: player.id, requestId: crypto.randomUUID() }); if (ok) {
        notify('Noticia enviada al speaker.');
    } }}/>}
 {modal && <Modal title={{ event: 'Preparar un nuevo evento', import: 'Tu lista, lista para el campo.', access: 'Un acceso para cada tablet', add: 'Añadir un jugador', news: 'Enviar una noticia al speaker', teams: 'Editar equipos' }[modal] || ''} subtitle={{ event: 'Cada evento conserva sus jugadores y valoraciones.', import: 'Importa una hoja o un CSV y revisa las columnas antes de guardar.', access: 'Genera un código y compártelo con la persona correspondiente.', add: 'Se añadirá al listado como pendiente de check-in.', news: 'El speaker podrá anunciarla en cuanto llegue.', teams: 'Personaliza los nombres y colores solo para este evento.' }[modal]} close={() => setModal('')} wide={modal === 'import'}>{modal === 'teams' && state.event ? <TeamEditor key={state.event.id} event={state.event} busy={busy} demo={demo} onSave={saveTeamSettings}/> : modal === 'event' ? <EventForm busy={busy} submit={async (b: any) => { if (demo) {
        notify('Inicia sesión para crear eventos.');
        return;
    } setBusy(true); try {
        const r = await api('events', b);
        setSelectedEvent(r.id);
        setModal('');
        notify('Evento creado. Ya puedes importar los inscritos.');
    }
    catch (e: any) {
        notify(e.message);
    }
    finally {
        setBusy(false);
    } }}/> : modal === 'import' ? <ImportForm demo={demo} event={state.event?.id || ''} submit={async (b: any) => { if (demo) {
        notify('Inicia sesión para importar jugadores.');
        return;
    } setBusy(true); try {
        const r = await api('import', b);
        await refresh();
        setModal('');
        notify(`${r.added} jugadores importados · ${r.skipped} duplicados omitidos.`);
    }
    catch (e: any) {
        notify(e.message);
    }
    finally {
        setBusy(false);
    } }} busy={busy}/> : modal === 'access' ? <AccessForm demo={demo} event={state.event?.id || ''} teamCount={state.event?.teamCount || 4} teamSettings={teamSettings}/> : modal === 'add' ? <AddForm busy={busy} submit={async (b: any) => { if (await act('import', { event: state.event!.id, players: [b] })) {
        setModal('');
        notify('Jugador añadido.');
    } }}/> : <NewsForm busy={busy} submit={async (text: string) => { if (await act('news', { event: state.event!.id, text, kind: 'note', requestId: crypto.randomUUID() })) {
        setModal('');
        notify('Noticia enviada.');
    } }}/>}</Modal>}
 {toast && <div className="toast" role="status"><Check size={17}/>{toast}<button aria-label="Cerrar aviso" onClick={() => setToast('')}><X size={16}/></button></div>}
 </div>;
}
function ArrowUpRight() { return <ExternalLink size={16}/>; }
function Stat({ title, value, foot, icon, suffix, progress }: {
    title: string;
    value: number;
    foot: string;
    icon: React.ReactNode;
    suffix?: string;
    progress?: number;
}) { return <div className="stat"><div><span>{title}</span>{icon}</div><strong>{String(value).padStart(2, '0')}<small>{suffix}</small></strong>{progress !== undefined && <div className="progress"><span style={{ width: progress * 100 + '%' }}/></div>}<p>{foot}</p></div>; }
function TeamCard({ team, players, active, onClick }: {
    team: typeof teams[number];
    players: Player[];
    active?: boolean;
    onClick: () => void;
}) { const count = players.filter(p => p.evaluation).length; return <button className={'team-card ' + (active ? 'selected' : '')} onClick={onClick} style={{ '--team-color': team.color, '--team-ink': teamInk(team.color) } as any}><div className="team-card-top"><span className="team-shirt"><ShieldCheck size={23}/></span><span className="team-card-number">{String(team.id).padStart(2, '0')}</span></div><h3>{team.name}</h3><p>{players.length} jugadores <span>·</span> Entrenador {team.id}</p><div className="team-card-foot"><span><ClipboardList size={14}/>{count}/{players.length} valorados</span><ArrowRight size={17}/></div><div className="team-progress"><span style={{ width: players.length ? count / players.length * 100 + '%' : 0 }}/></div></button>; }
function Modal({ title, subtitle, close, children, wide = false }: {
    title: string;
    subtitle?: string;
    close: () => void;
    children: React.ReactNode;
    wide?: boolean;
}) { useEffect(() => { const fn = (e: KeyboardEvent) => { if (e.key === 'Escape')
    close(); }; document.addEventListener('keydown', fn); const old = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.removeEventListener('keydown', fn); document.body.style.overflow = old; }; }, [close]); return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget)
    close(); }}><section className={'modal ' + (wide ? 'wide' : '')} role="dialog" aria-modal="true" aria-label={title}><header><div><span className="eyebrow">EVENTSFEED · EN EL CAMPO</span><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="icon-btn" aria-label="Cerrar" onClick={close}><X size={22}/></button></header>{children}</section></div>; }
function PlayerModal({ player: p, teamLabel, admin, demo, busy, onClose, onSave, onDetails, onNews }: any) { const [tab, setTab] = useState('evaluation'), [ev, setEv] = useState<Evaluation>(p.evaluation ? { ...p.evaluation, scores: [...p.evaluation.scores] } : { ...empty, scores: [null, null, null, null] }), [details, setDetails] = useState({ ...p }), [text, setText] = useState(''); const dirty = JSON.stringify(ev) !== JSON.stringify(p.evaluation || empty); const close = () => { if (!dirty || confirm('Hay cambios de valoración sin guardar. ¿Cerrar la ficha?'))
    onClose(); }; return <Modal title={p.name} subtitle={`${p.position || 'Sin posición'} · ${p.club || 'Sin club'} · ${teamLabel}`} close={close} wide><div className="modal-tabs">{[['evaluation', 'Valoración'], ['details', 'Ficha del jugador'], ['news', 'Enviar al speaker']].map(([k, v]) => <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{v}</button>)}</div>{tab === 'evaluation' ? <form onSubmit={e => { e.preventDefault(); onSave({ id: p.id, ...ev }); }}><div className="score-intro"><h3>Tu criterio cuenta.</h3><span>{ev.scores.filter(n => n !== null).length}/4 apartados</span></div><div className="score-inputs">{metrics.map((m, i) => <div className="metric" key={m}><div><label>{m}</label><span>{ev.scores[i] || '—'} <small>/ 10</small></span></div><div className="score-buttons">{Array.from({ length: 10 }, (_, j) => j + 1).map(n => <button type="button" key={n} disabled={demo} aria-label={`${m}: ${n}`} aria-pressed={ev.scores[i] === n} className={ev.scores[i] === n ? 'selected' : ''} onClick={() => setEv({ ...ev, scores: ev.scores.map((v, k) => k === i ? n : v) })}>{n}</button>)}</div></div>)}</div><label className="field">Categoría recomendada<select value={ev.category} disabled={demo} onChange={e => setEv({ ...ev, category: e.target.value })}><option value="">Seleccionar categoría…</option>{categories.map(c => <option key={c}>{c}</option>)}</select></label><label className="field">Comentarios del entrenador<textarea rows={4} maxLength={6000} value={ev.comment} disabled={demo} onChange={e => setEv({ ...ev, comment: e.target.value })} placeholder="Fortalezas, aspectos a mejorar y sensaciones en el campo…"/></label><div className="form-foot"><span><LockKeyhole size={13}/> Solo el entrenador y Antonio ven esta valoración.</span><button className="btn primary" disabled={busy || demo}><Check size={17}/> Guardar valoración</button></div></form> : tab === 'details' ? <form onSubmit={e => { e.preventDefault(); onDetails({ id: p.id, version: p.version, ...Object.fromEntries((admin ? ['name', 'birthyear', 'club', 'position', 'phone', 'city', 'number'] : ['position', 'number']).map(k => [k, details[k] || ''])) }); }}><div className="form-grid">{[['name', 'Nombre completo'], ['birthyear', 'Año de nacimiento'], ['club', 'Equipo actual'], ['position', 'Posición'], ['number', 'Dorsal'], ...(admin ? [['phone', 'Teléfono'], ['city', 'Ciudad']] : [])].map(([key, label]) => <label key={key} className="field">{label}<input value={details[key] || ''} required={key === 'name'} disabled={demo || (!admin && !['position', 'number'].includes(key))} onChange={e => setDetails({ ...details, [key]: e.target.value })}/></label>)}</div><div className="form-foot"><span>Goles registrados: {p.goals}</span><button className="btn primary" disabled={busy || demo}>Guardar ficha</button></div></form> : <div><div className="news-quick"><button className="btn" disabled={busy || demo} onClick={() => onNews({ kind: 'goal' })}><Goal size={20}/> Registrar un gol</button><button className="btn" disabled={busy || demo} onClick={() => onNews({ kind: 'clean' })}><ShieldCheck size={20}/> Partido sin encajar</button></div><p className="hint">Registra cada gol una sola vez. La portería a cero se confirma al terminar el partido.</p><form onSubmit={e => { e.preventDefault(); onNews({ kind: 'note', text }); }}><label className="field">Noticia para megafonía<textarea required maxLength={1400} rows={4} disabled={demo} value={text} onChange={e => setText(e.target.value)} placeholder={`${p.name} está destacando por…`}/></label><div className="form-foot"><span>Evita incluir datos de contacto o comentarios privados.</span><button className="btn primary" disabled={busy || demo}><Megaphone size={17}/> Enviar al speaker</button></div></form></div>}</Modal>; }
function EventForm({ submit, busy }: any) { return <form onSubmit={e => { e.preventDefault(); submit(Object.fromEntries(new FormData(e.currentTarget))); }}><label className="field">Nombre del evento<input name="name" required maxLength={180} placeholder="Ej. United · Madrid — Diciembre" autoFocus/></label><div className="form-grid"><label className="field">Fecha<input type="date" name="date"/></label><label className="field">Campo / ubicación<input name="location" placeholder="Nombre del campo"/></label></div><div className="form-foot"><span>Podrás elegir y organizar los equipos desde el check-in.</span><button className="btn primary" disabled={busy}>Crear evento <ArrowRight size={17}/></button></div></form>; }
function AddForm({ submit, busy }: any) { return <form onSubmit={e => { e.preventDefault(); submit(Object.fromEntries(new FormData(e.currentTarget))); }}><div className="form-grid">{importFields.map(([k, label]) => <label className="field" key={k}>{label}<input name={k} required={k === 'name'}/></label>)}</div><div className="form-foot"><span>Podrás asignarle equipo desde el check-in.</span><button className="btn primary" disabled={busy}>Añadir jugador</button></div></form>; }
function ImportForm({ demo, event, submit, busy }: any) { const [rows, setRows] = useState<string[][]>([]), [mapping, setMapping] = useState<Record<string, number>>({}), [url, setUrl] = useState(''), [error, setError] = useState(''), [fetching, setFetching] = useState(false); function load(csv: string) { try {
    const parsed = parseCSV(csv);
    if (parsed.length < 2)
        throw Error('El CSV debe tener cabeceras y al menos un jugador.');
    setRows(parsed);
    setMapping(autoMap(parsed[0]));
    setError('');
}
catch (e: any) {
    setError(e.message);
} } const validRows = rows.slice(1).filter(r => mapping.name >= 0 && r[mapping.name]?.trim()); return <div>{!rows.length ? <><div className="import-note"><FileSpreadsheet size={21}/><div><strong>Tu hoja, sin cambiar los permisos.</strong><p>Descarga la pestaña de Google Sheets en Archivo → Descargar → CSV. Solo se importarán las columnas que selecciones.</p></div></div><label className="upload-box"><Upload size={30}/><strong>Seleccionar archivo CSV</strong><span>Nombre, teléfono, posición, club… · hasta 300 jugadores</span><input type="file" accept=".csv,.tsv,text/csv" disabled={demo} onChange={async (e) => { const file = e.target.files?.[0]; if (file) {
    if (file.size > 1000000) {
        setError('El archivo supera 1 MB.');
        return;
    }
    load(await file.text());
} }}/></label><details className="sheet-link"><summary>Importar desde un enlace de Google Sheets</summary><p className="hint">Funciona si la hoja permite exportar sin iniciar sesión. Si es privada, usa el CSV.</p><div className="inline-form"><input aria-label="Enlace de Google Sheets" type="url" placeholder="https://docs.google.com/spreadsheets/d/…" value={url} onChange={e => setUrl(e.target.value)}/><button className="btn" disabled={!url || fetching || demo} onClick={async () => { setFetching(true); setError(''); try {
    load((await api('sheet', { url })).csv);
}
catch (e: any) {
    setError(e.message);
}
finally {
    setFetching(false);
} }}>{fetching ? 'Leyendo…' : 'Leer hoja'}</button></div></details></> : <><div className="import-ready"><CheckCheck size={21}/><div><strong>{validRows.length} jugadores detectados</strong><p>Revisa la correspondencia. Las columnas sin asignar se ignorarán.</p></div><button className="text-btn" onClick={() => setRows([])}>Cambiar archivo</button></div><div className="mapping-grid">{importFields.map(([key, label]) => <label className="field" key={key}>{label}{key === 'name' ? ' *' : ''}<select value={mapping[key] ?? -1} onChange={e => setMapping({ ...mapping, [key]: Number(e.target.value) })}><option value={-1}>No importar</option>{rows[0].map((h, i) => <option key={i} value={i}>{h || `Columna ${i + 1}`}</option>)}</select></label>)}</div><div className="preview-table"><table><thead><tr><th>NOMBRE</th><th>POSICIÓN</th><th>EQUIPO ACTUAL</th></tr></thead><tbody>{validRows.slice(0, 4).map((r, i) => <tr key={i}><td>{r[mapping.name]}</td><td>{r[mapping.position] || '—'}</td><td>{r[mapping.club] || '—'}</td></tr>)}</tbody></table></div><p className="hint">La columna «Estado» de la hoja no marca la asistencia. Todos entran como pendientes. Los duplicados de nombre y año se omiten sin sobrescribir valoraciones.</p><div className="form-foot"><span>La hoja original no se modificará.</span><button className="btn primary" disabled={busy || demo || !validRows.length || validRows.length > 300} onClick={() => submit({ event, players: validRows.map(r => Object.fromEntries(importFields.map(([k]) => [k, mapping[k] >= 0 ? r[mapping[k]] || '' : '']))) })}><Upload size={16}/> Importar {validRows.length} jugadores</button></div></>}{error && <p className="error" role="alert">{error}</p>}</div>; }
function AccessForm({ demo, event, teamCount, teamSettings }: any) { const availableTeams = eventTeams(teamCount, teamSettings); const [codes, setCodes] = useState<Record<string, string>>({}), [busy, setBusy] = useState(''), [message, setMessage] = useState(''); return <div><div className="import-note"><LockKeyhole size={20}/><p>Genera un PIN numérico de 4 cifras para cada equipo y para el speaker. El mismo PIN sirve para volver a iniciar sesión. Renovarlo cierra las sesiones anteriores de ese equipo. Guárdalo al generarlo: no se podrá recuperar.</p></div>{[...availableTeams, { id: 0, name: 'Speaker', color: '#1d332b' }].map(t => <div className="access-row" key={t.id}><span className="event-emblem" style={{ color: teamInk(t.color), background: t.color + '17' }}>{t.id ? <Users size={19}/> : <Megaphone size={19}/>}</span><div><strong>{t.name}</strong><small>{t.id ? 'Solo sus jugadores y sus valoraciones' : 'Noticias para anunciar, sin datos privados'}</small>{codes[t.id] && <code>{codes[t.id]}</code>}</div><button className="btn small" disabled={demo || !event || !!busy} onClick={async () => { if (codes[t.id] && !confirm('¿Renovar y cerrar las sesiones anteriores?'))
    return; setBusy(String(t.id)); try {
    const r = await api('access', { event, team: t.id });
    setCodes({ ...codes, [t.id]: r.code });
    setMessage('PIN de 4 cifras generado. Abre esta web en la tablet y entra con ese PIN.');
}
catch (e: any) {
    setMessage(e.message);
}
finally {
    setBusy('');
} }}>{codes[t.id] ? 'Renovar PIN' : 'Generar PIN'}</button>{codes[t.id] && <button className="icon-btn" aria-label={'Copiar código ' + t.name} onClick={async () => { try {
    await navigator.clipboard.writeText(codes[t.id]);
    setMessage('Código copiado.');
}
catch {
    setMessage('Selecciona el código y cópialo manualmente.');
} }}><Copy size={17}/></button>}</div>)}{message && <p className="hint" role="status">{message}</p>}<p className="hint">Cada entrenador puede acceder desde una tablet o un móvil con el navegador. No necesitan instalar ninguna aplicación ni tener cuenta de ChatGPT.</p></div>; }
function NewsForm({ submit, busy }: any) { const [text, setText] = useState(''); return <form onSubmit={e => { e.preventDefault(); submit(text); }}><label className="field">Texto para el speaker<textarea required maxLength={1400} rows={5} value={text} onChange={e => setText(e.target.value)} placeholder="Una noticia del campo lista para anunciar…" autoFocus/></label><div className="form-foot"><span>Será visible para el speaker.</span><button className="btn primary" disabled={busy}>Enviar noticia <Megaphone size={17}/></button></div></form>; }
