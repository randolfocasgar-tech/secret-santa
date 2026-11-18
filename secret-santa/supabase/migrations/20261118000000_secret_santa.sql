-- =====================================================================
-- Amigo Secreto — esquema inicial
--
-- Principios:
--   * Toda escritura sensible pasa por funciones RPC (SECURITY DEFINER)
--     que validan autenticación, autorización y estado del intercambio.
--   * Los clientes (roles anon / authenticated) no tienen permisos de
--     INSERT/UPDATE/DELETE directos sobre las tablas, salvo el perfil propio.
--   * RLS activado en todas las tablas: cada quien solo lee lo que le toca.
--   * Nadie (ni el organizador) tiene una vía para listar todas las
--     asignaciones. Esto NO protege frente a quien administra la base de
--     datos o la infraestructura (rol postgres / service_role).
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------

-- Lanza un error con un código legible por la aplicación (message) y un
-- texto en español para mostrar (hint).
create or replace function public._fail(p_code text, p_hint text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = 'P0001', message = p_code, hint = p_hint;
end;
$$;

-- Entero aleatorio en [0, p_max) usando el generador criptográfico.
create or replace function public._secure_random_int(p_max integer)
returns integer
language sql
volatile
set search_path = ''
as $$
  select (('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint % p_max)::integer;
$$;

-- Código de invitación difícil de adivinar (~96 bits), apto para URL.
create or replace function public._generate_invite_code()
returns text
language sql
volatile
set search_path = ''
as $$
  select translate(encode(extensions.gen_random_bytes(12), 'base64'), '+/=', '-_');
$$;

create or replace function public._touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 60),
  wishlist     text not null default '' check (char_length(wishlist) <= 2000),
  likes        text not null default '' check (char_length(likes) <= 2000),
  avoid        text not null default '' check (char_length(avoid) <= 2000),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.exchanges (
  id           uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references auth.users (id) on delete cascade,
  name         text not null check (char_length(btrim(name)) between 1 and 80),
  gift_date    date not null,
  budget       numeric(12, 2) not null check (budget >= 0 and budget <= 1000000000),
  currency     text not null check (currency ~ '^[A-Z]{3}$'),
  rules        text not null default '' check (char_length(rules) <= 2000),
  invite_code  text not null unique default public._generate_invite_code(),
  status       text not null default 'open' check (status in ('open', 'drawn')),
  draw_version integer not null default 0,
  drawn_at     timestamptz,
  is_demo      boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index exchanges_organizer_idx on public.exchanges (organizer_id);

create table public.participants (
  id           uuid primary key default gen_random_uuid(),
  exchange_id  uuid not null references public.exchanges (id) on delete cascade,
  -- user_id es NULL únicamente para participantes ficticios del modo demo.
  user_id      uuid references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 60),
  is_demo      boolean not null default false,
  joined_at    timestamptz not null default now(),
  constraint participants_one_per_account unique (exchange_id, user_id),
  constraint participants_id_exchange unique (id, exchange_id),
  constraint participants_demo_has_no_user check ((user_id is null) = is_demo)
);
create unique index participants_unique_name
  on public.participants (exchange_id, lower(btrim(display_name)));
create index participants_user_idx on public.participants (user_id);

-- Preferencias por intercambio (separadas para que solo las vea su dueño
-- y, tras el sorteo, quien le regala, mediante get_my_assignment).
create table public.participant_preferences (
  participant_id uuid primary key references public.participants (id) on delete cascade,
  wishlist       text not null default '' check (char_length(wishlist) <= 2000),
  likes          text not null default '' check (char_length(likes) <= 2000),
  avoid          text not null default '' check (char_length(avoid) <= 2000),
  updated_at     timestamptz not null default now()
);

-- Exclusión: giver_id NO puede regalarle a receiver_id.
-- Si bidirectional = true, tampoco receiver_id puede regalarle a giver_id.
create table public.exclusions (
  id            uuid primary key default gen_random_uuid(),
  exchange_id   uuid not null references public.exchanges (id) on delete cascade,
  giver_id      uuid not null,
  receiver_id   uuid not null,
  bidirectional boolean not null default true,
  created_at    timestamptz not null default now(),
  constraint exclusions_not_self check (giver_id <> receiver_id),
  constraint exclusions_giver_fk foreign key (giver_id, exchange_id)
    references public.participants (id, exchange_id) on delete cascade,
  constraint exclusions_receiver_fk foreign key (receiver_id, exchange_id)
    references public.participants (id, exchange_id) on delete cascade
);
-- Una sola exclusión por par de personas (en cualquier orden).
create unique index exclusions_unique_pair
  on public.exclusions (exchange_id, least(giver_id, receiver_id), greatest(giver_id, receiver_id));

create table public.assignments (
  id           uuid primary key default gen_random_uuid(),
  exchange_id  uuid not null references public.exchanges (id) on delete cascade,
  draw_version integer not null,
  giver_id     uuid not null,
  receiver_id  uuid not null,
  revealed_at  timestamptz,
  created_at   timestamptz not null default now(),
  constraint assignments_not_self check (giver_id <> receiver_id),
  constraint assignments_one_gift_per_giver unique (exchange_id, giver_id),
  constraint assignments_one_gift_per_receiver unique (exchange_id, receiver_id),
  constraint assignments_giver_fk foreign key (giver_id, exchange_id)
    references public.participants (id, exchange_id) on delete cascade,
  constraint assignments_receiver_fk foreign key (receiver_id, exchange_id)
    references public.participants (id, exchange_id) on delete cascade
);

create trigger profiles_touch before update on public.profiles
  for each row execute function public._touch_updated_at();
create trigger exchanges_touch before update on public.exchanges
  for each row execute function public._touch_updated_at();
create trigger participant_preferences_touch before update on public.participant_preferences
  for each row execute function public._touch_updated_at();

-- ---------------------------------------------------------------------
-- Bloqueo tras el sorteo: participantes y exclusiones no cambian mientras
-- el intercambio esté sorteado. El FOR SHARE serializa con el FOR UPDATE
-- del sorteo, así que una unión simultánea espera y luego falla.
-- Se permite el borrado en cascada (borrar el intercambio o la cuenta).
-- ---------------------------------------------------------------------
create or replace function public._ensure_exchange_open()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_exchange_id uuid;
  v_status text;
begin
  if pg_trigger_depth() > 1 then
    return coalesce(new, old);
  end if;

  v_exchange_id := case when tg_op = 'DELETE' then old.exchange_id else new.exchange_id end;

  select status into v_status
  from public.exchanges
  where id = v_exchange_id
  for share;

  if v_status = 'drawn' then
    perform public._fail('EXCHANGE_LOCKED',
      'El sorteo ya se realizó: los participantes y las exclusiones están bloqueados.');
  end if;

  return coalesce(new, old);
end;
$$;

create trigger participants_lock
  before insert or update or delete on public.participants
  for each row execute function public._ensure_exchange_open();
create trigger exclusions_lock
  before insert or update or delete on public.exclusions
  for each row execute function public._ensure_exchange_open();

-- ---------------------------------------------------------------------
-- Perfil automático al registrarse
-- ---------------------------------------------------------------------
create or replace function public._handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 60)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public._handle_new_user();

-- ---------------------------------------------------------------------
-- Helpers de autorización (SECURITY DEFINER para evitar recursión de RLS)
-- ---------------------------------------------------------------------
create or replace function public.is_exchange_organizer(p_exchange_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.exchanges e
    where e.id = p_exchange_id and e.organizer_id = (select auth.uid())
  );
$$;

create or replace function public.is_exchange_member(p_exchange_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_exchange_organizer(p_exchange_id) or exists (
    select 1 from public.participants p
    where p.exchange_id = p_exchange_id and p.user_id = (select auth.uid())
  );
$$;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.exchanges enable row level security;
alter table public.participants enable row level security;
alter table public.participant_preferences enable row level security;
alter table public.exclusions enable row level security;
alter table public.assignments enable row level security;

-- Privilegios mínimos: solo lectura (filtrada por RLS) + editar el perfil propio.
revoke all on public.profiles, public.exchanges, public.participants,
  public.participant_preferences, public.exclusions, public.assignments
  from anon, authenticated;

grant select on public.profiles, public.exchanges, public.participants,
  public.participant_preferences, public.exclusions, public.assignments
  to authenticated;
grant update (display_name, wishlist, likes, avoid) on public.profiles to authenticated;

create policy "perfil propio: leer" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "perfil propio: editar" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "intercambios: miembros leen" on public.exchanges
  for select to authenticated using (public.is_exchange_member(id));

create policy "participantes: miembros leen" on public.participants
  for select to authenticated using (public.is_exchange_member(exchange_id));

create policy "preferencias: solo las propias" on public.participant_preferences
  for select to authenticated using (
    exists (
      select 1 from public.participants p
      where p.id = participant_id and p.user_id = (select auth.uid())
    )
  );

create policy "exclusiones: solo organizador" on public.exclusions
  for select to authenticated using (public.is_exchange_organizer(exchange_id));

-- Únicamente la asignación en la que yo soy quien regala.
create policy "asignaciones: solo la propia" on public.assignments
  for select to authenticated using (
    exists (
      select 1 from public.participants p
      where p.id = giver_id and p.user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------
-- Funciones internas de validación
-- ---------------------------------------------------------------------
create or replace function public._require_user()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    perform public._fail('NOT_AUTHENTICATED', 'Debes iniciar sesión.');
  end if;
  return v_uid;
end;
$$;

-- Bloquea la fila del intercambio y verifica que quien llama sea el organizador.
create or replace function public._lock_exchange_as_organizer(p_exchange_id uuid)
returns public.exchanges
language plpgsql
set search_path = ''
as $$
declare
  v_ex public.exchanges;
begin
  select * into v_ex from public.exchanges where id = p_exchange_id for update;
  if not found or v_ex.organizer_id <> public._require_user() then
    -- Mismo mensaje para "no existe" y "no autorizado": no revela existencia.
    perform public._fail('NOT_FOUND_OR_FORBIDDEN',
      'No encontramos el intercambio o no tienes permiso para administrarlo.');
  end if;
  return v_ex;
end;
$$;

create or replace function public._clean_text(p_value text, p_max integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select left(btrim(coalesce(p_value, '')), p_max);
$$;

-- ---------------------------------------------------------------------
-- Algoritmo del sorteo (interno, no expuesto)
--
-- Modela el sorteo como un emparejamiento perfecto en un grafo bipartito
-- (quien regala -> quien recibe) donde están prohibidas las aristas a uno
-- mismo y las exclusiones. Usa caminos aumentantes (Kuhn/BFS), que siempre
-- encuentran una solución si existe, y luego mezcla con intercambios
-- aleatorios válidos para que el resultado no dependa del orden de entrada.
-- Devuelve pares (giver_id, receiver_id) o lanza IMPOSSIBLE_CONSTRAINTS.
-- ---------------------------------------------------------------------
create or replace function public._compute_draw(p_exchange_id uuid)
returns table (giver_id uuid, receiver_id uuid)
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_ids     uuid[];
  v_names   text[];
  n         integer;
  allowed   boolean[];
  match_g   integer[];  -- match_g[giver]    = receiver
  match_r   integer[];  -- match_r[receiver] = giver
  parent_r  integer[];
  queue     integer[];
  qhead     integer;
  g         integer;
  r         integer;
  k         integer;
  off       integer;
  root      integer;
  prev_r    integer;
  found_r   integer;
  a         integer;
  b         integer;
  ra        integer;
  rb        integer;
  v_ex      record;
  gi        integer;
  ri        integer;
  cnt       integer;
  v_blocked text[];
begin
  select array_agg(t.id order by t.sort_key), array_agg(t.display_name order by t.sort_key)
    into v_ids, v_names
  from (
    select p.id, p.display_name, extensions.gen_random_bytes(8) as sort_key
    from public.participants p
    where p.exchange_id = p_exchange_id
  ) t;

  n := coalesce(array_length(v_ids, 1), 0);
  if n < 3 then
    perform public._fail('NOT_ENOUGH_PARTICIPANTS',
      format('Se necesitan al menos 3 participantes para sortear (hay %s).', n));
  end if;

  -- Matriz de permitidos aplanada: allowed[(g-1)*n + r]
  allowed := array_fill(true, array[n * n]);
  for g in 1..n loop
    allowed[(g - 1) * n + g] := false;
  end loop;

  for v_ex in
    select e.giver_id as eg, e.receiver_id as er, e.bidirectional as bi
    from public.exclusions e where e.exchange_id = p_exchange_id
  loop
    gi := array_position(v_ids, v_ex.eg);
    ri := array_position(v_ids, v_ex.er);
    if gi is not null and ri is not null then
      allowed[(gi - 1) * n + ri] := false;
      if v_ex.bi then
        allowed[(ri - 1) * n + gi] := false;
      end if;
    end if;
  end loop;

  -- Diagnóstico claro de los casos más comunes.
  v_blocked := '{}';
  for g in 1..n loop
    cnt := 0;
    for r in 1..n loop
      if allowed[(g - 1) * n + r] then cnt := cnt + 1; end if;
    end loop;
    if cnt = 0 then
      v_blocked := v_blocked || format('%s no puede regalarle a nadie', v_names[g]);
    end if;
  end loop;
  for r in 1..n loop
    cnt := 0;
    for g in 1..n loop
      if allowed[(g - 1) * n + r] then cnt := cnt + 1; end if;
    end loop;
    if cnt = 0 then
      v_blocked := v_blocked || format('nadie puede regalarle a %s', v_names[r]);
    end if;
  end loop;
  if array_length(v_blocked, 1) > 0 then
    perform public._fail('IMPOSSIBLE_CONSTRAINTS',
      'Con las exclusiones actuales el sorteo es imposible: ' || array_to_string(v_blocked, '; ')
      || '. Elimina alguna exclusión o agrega más participantes.');
  end if;

  -- Emparejamiento por caminos aumentantes (BFS).
  match_g := array_fill(0, array[n]);
  match_r := array_fill(0, array[n]);

  for root in 1..n loop
    parent_r := array_fill(0, array[n]);
    queue := array[root];
    qhead := 1;
    found_r := 0;

    while qhead <= array_length(queue, 1) and found_r = 0 loop
      g := queue[qhead];
      qhead := qhead + 1;
      off := public._secure_random_int(n);
      for k in 0..n - 1 loop
        r := ((k + off) % n) + 1;
        if allowed[(g - 1) * n + r] and parent_r[r] = 0 then
          parent_r[r] := g;
          if match_r[r] = 0 then
            found_r := r;
            exit;
          end if;
          queue := queue || match_r[r];
        end if;
      end loop;
    end loop;

    if found_r = 0 then
      perform public._fail('IMPOSSIBLE_CONSTRAINTS',
        'Con las exclusiones actuales no existe ninguna combinación válida. '
        || 'Elimina alguna exclusión o agrega más participantes.');
    end if;

    -- Aplica el camino aumentante.
    r := found_r;
    loop
      g := parent_r[r];
      prev_r := match_g[g];
      match_g[g] := r;
      match_r[r] := g;
      exit when g = root;
      r := prev_r;
    end loop;
  end loop;

  -- Mezcla: intercambia destinatarios entre dos personas si ambas
  -- asignaciones nuevas siguen siendo válidas (cadena simétrica).
  for k in 1..(n * 40) loop
    a := public._secure_random_int(n) + 1;
    b := public._secure_random_int(n) + 1;
    if a <> b then
      ra := match_g[a];
      rb := match_g[b];
      if allowed[(a - 1) * n + rb] and allowed[(b - 1) * n + ra] then
        match_g[a] := rb;
        match_g[b] := ra;
      end if;
    end if;
  end loop;

  for g in 1..n loop
    giver_id := v_ids[g];
    receiver_id := v_ids[match_g[g]];
    return next;
  end loop;
end;
$$;

-- Ejecuta y guarda el sorteo. Asume que el intercambio ya está bloqueado.
create or replace function public._perform_draw(p_exchange_id uuid, p_version integer)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.assignments (exchange_id, draw_version, giver_id, receiver_id)
  select p_exchange_id, p_version, d.giver_id, d.receiver_id
  from public._compute_draw(p_exchange_id) d;
  get diagnostics v_count = row_count;

  update public.exchanges
     set status = 'drawn', draw_version = p_version, drawn_at = now()
   where id = p_exchange_id;

  return v_count;
end;
$$;

-- =====================================================================
-- API pública (RPC)
-- =====================================================================

-- Crear intercambio ---------------------------------------------------
create or replace function public.create_exchange(
  p_name text,
  p_gift_date date,
  p_budget numeric,
  p_currency text,
  p_rules text default '',
  p_organizer_participates boolean default true,
  p_organizer_display_name text default null,
  p_is_demo boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := public._require_user();
  v_id   uuid;
  v_pid  uuid;
  v_name text;
  v_prof public.profiles;
begin
  if char_length(btrim(coalesce(p_name, ''))) = 0 then
    perform public._fail('INVALID_NAME', 'Escribe un nombre para el intercambio.');
  end if;
  -- Margen de un día por diferencias de zona horaria con el servidor (UTC).
  if p_gift_date is null or p_gift_date < current_date - 1 then
    perform public._fail('INVALID_DATE', 'La fecha de entrega debe ser hoy o una fecha futura.');
  end if;
  if p_budget is null or p_budget < 0 then
    perform public._fail('INVALID_BUDGET', 'El presupuesto debe ser un número mayor o igual a 0.');
  end if;
  if upper(btrim(coalesce(p_currency, ''))) !~ '^[A-Z]{3}$' then
    perform public._fail('INVALID_CURRENCY', 'Elige una moneda válida.');
  end if;

  insert into public.exchanges (organizer_id, name, gift_date, budget, currency, rules, is_demo)
  values (v_uid, public._clean_text(p_name, 80), p_gift_date, round(p_budget, 2),
          upper(btrim(p_currency)), public._clean_text(p_rules, 2000), coalesce(p_is_demo, false))
  returning id into v_id;

  if coalesce(p_organizer_participates, true) then
    select * into v_prof from public.profiles where id = v_uid;
    v_name := public._clean_text(coalesce(nullif(btrim(p_organizer_display_name), ''), v_prof.display_name), 60);
    if v_name = '' then
      perform public._fail('INVALID_DISPLAY_NAME', 'Escribe tu nombre para participar.');
    end if;
    insert into public.participants (exchange_id, user_id, display_name)
    values (v_id, v_uid, v_name)
    returning id into v_pid;
    insert into public.participant_preferences (participant_id, wishlist, likes, avoid)
    values (v_pid, coalesce(v_prof.wishlist, ''), coalesce(v_prof.likes, ''), coalesce(v_prof.avoid, ''));
  end if;

  if coalesce(p_is_demo, false) then
    with demo(name, wishlist, likes, avoid) as (
      values
        ('Ana (demo)',   'Un libro de cocina, una taza bonita', 'Café, plantas', 'Perfumes'),
        ('Bruno (demo)', 'Audífonos, juegos de mesa', 'Música, senderismo', 'Ropa'),
        ('Carla (demo)', 'Cuaderno de dibujo, acuarelas', 'Arte, té', 'Dulces'),
        ('Diego (demo)', 'Calcetines divertidos, una planta', 'Fútbol, cine', 'Alcohol')
    ), ins as (
      insert into public.participants (exchange_id, user_id, display_name, is_demo)
      select v_id, null, d.name, true from demo d
      returning id, display_name
    )
    insert into public.participant_preferences (participant_id, wishlist, likes, avoid)
    select ins.id, d.wishlist, d.likes, d.avoid from ins join demo d on d.name = ins.display_name;
  end if;

  return v_id;
end;
$$;

-- Editar datos generales (permitido también después del sorteo) --------
create or replace function public.update_exchange(
  p_exchange_id uuid,
  p_name text,
  p_gift_date date,
  p_budget numeric,
  p_currency text,
  p_rules text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public._lock_exchange_as_organizer(p_exchange_id);
  if char_length(btrim(coalesce(p_name, ''))) = 0 then
    perform public._fail('INVALID_NAME', 'Escribe un nombre para el intercambio.');
  end if;
  if p_gift_date is null then
    perform public._fail('INVALID_DATE', 'Indica la fecha de entrega.');
  end if;
  if p_budget is null or p_budget < 0 then
    perform public._fail('INVALID_BUDGET', 'El presupuesto debe ser un número mayor o igual a 0.');
  end if;
  if upper(btrim(coalesce(p_currency, ''))) !~ '^[A-Z]{3}$' then
    perform public._fail('INVALID_CURRENCY', 'Elige una moneda válida.');
  end if;
  update public.exchanges
     set name = public._clean_text(p_name, 80),
         gift_date = p_gift_date,
         budget = round(p_budget, 2),
         currency = upper(btrim(p_currency)),
         rules = public._clean_text(p_rules, 2000)
   where id = p_exchange_id;
end;
$$;

create or replace function public.delete_exchange(p_exchange_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public._lock_exchange_as_organizer(p_exchange_id);
  delete from public.exchanges where id = p_exchange_id;
end;
$$;

create or replace function public.regenerate_invite_code(p_exchange_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := public._generate_invite_code();
begin
  perform public._lock_exchange_as_organizer(p_exchange_id);
  update public.exchanges set invite_code = v_code where id = p_exchange_id;
  return v_code;
end;
$$;

-- Vista previa de una invitación (no revela participantes ni resultados).
create or replace function public.get_invite_preview(p_code text)
returns table (
  exchange_id uuid,
  name text,
  gift_date date,
  budget numeric,
  currency text,
  rules text,
  organizer_name text,
  participant_count integer,
  status text,
  is_member boolean,
  is_participant boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.name, e.gift_date, e.budget, e.currency, e.rules,
         coalesce(nullif(pr.display_name, ''), 'El organizador'),
         (select count(*)::integer from public.participants p where p.exchange_id = e.id),
         e.status,
         (e.organizer_id = (select auth.uid())) or exists (
           select 1 from public.participants p
           where p.exchange_id = e.id and p.user_id = (select auth.uid())),
         exists (
           select 1 from public.participants p
           where p.exchange_id = e.id and p.user_id = (select auth.uid()))
  from public.exchanges e
  left join public.profiles pr on pr.id = e.organizer_id
  where e.invite_code = btrim(p_code);
$$;

-- Unirse con un código de invitación ----------------------------------
create or replace function public.join_exchange(
  p_code text,
  p_display_name text,
  p_wishlist text default '',
  p_likes text default '',
  p_avoid text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := public._require_user();
  v_ex   public.exchanges;
  v_pid  uuid;
  v_name text := public._clean_text(p_display_name, 60);
  v_cnt  integer;
begin
  select * into v_ex from public.exchanges where invite_code = btrim(coalesce(p_code, '')) for share;
  if not found then
    perform public._fail('INVALID_INVITE', 'El enlace de invitación no es válido o fue reemplazado.');
  end if;
  if v_ex.status = 'drawn' then
    perform public._fail('EXCHANGE_LOCKED',
      'El sorteo de este intercambio ya se realizó; ya no es posible unirse.');
  end if;
  if exists (select 1 from public.participants where exchange_id = v_ex.id and user_id = v_uid) then
    perform public._fail('ALREADY_JOINED', 'Ya formas parte de este intercambio.');
  end if;
  if v_name = '' then
    perform public._fail('INVALID_DISPLAY_NAME', 'Escribe tu nombre.');
  end if;
  select count(*) into v_cnt from public.participants where exchange_id = v_ex.id;
  if v_cnt >= 200 then
    perform public._fail('TOO_MANY_PARTICIPANTS', 'Este intercambio alcanzó el máximo de 200 participantes.');
  end if;

  begin
    insert into public.participants (exchange_id, user_id, display_name)
    values (v_ex.id, v_uid, v_name)
    returning id into v_pid;
  exception when unique_violation then
    if exists (select 1 from public.participants where exchange_id = v_ex.id and user_id = v_uid) then
      perform public._fail('ALREADY_JOINED', 'Ya formas parte de este intercambio.');
    end if;
    perform public._fail('DUPLICATE_NAME',
      'Ya hay alguien con ese nombre en el intercambio. Agrega una inicial o un apodo.');
  end;

  insert into public.participant_preferences (participant_id, wishlist, likes, avoid)
  values (v_pid, public._clean_text(p_wishlist, 2000), public._clean_text(p_likes, 2000),
          public._clean_text(p_avoid, 2000));

  return v_ex.id;
end;
$$;

-- Salir del intercambio (solo antes del sorteo) ------------------------
create or replace function public.leave_exchange(p_exchange_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public._require_user();
begin
  delete from public.participants where exchange_id = p_exchange_id and user_id = v_uid;
  if not found then
    perform public._fail('NOT_A_PARTICIPANT', 'No participas en este intercambio.');
  end if;
end;
$$;

-- Organizador: quitar a un participante (antes del sorteo) -------------
create or replace function public.remove_participant(p_participant_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_exchange_id uuid;
begin
  select exchange_id into v_exchange_id from public.participants where id = p_participant_id;
  perform public._lock_exchange_as_organizer(v_exchange_id);
  delete from public.participants where id = p_participant_id;
end;
$$;

-- Organizador: agregar participantes ficticios (solo intercambios demo) --
create or replace function public.add_demo_participant(p_exchange_id uuid, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ex  public.exchanges := public._lock_exchange_as_organizer(p_exchange_id);
  v_pid uuid;
  v_name text := public._clean_text(p_display_name, 48);
begin
  if not v_ex.is_demo then
    perform public._fail('NOT_DEMO', 'Solo los intercambios de demostración admiten participantes ficticios.');
  end if;
  if v_name = '' then
    perform public._fail('INVALID_DISPLAY_NAME', 'Escribe un nombre.');
  end if;
  if v_name !~* '\(demo\)$' then
    v_name := v_name || ' (demo)';
  end if;
  begin
    insert into public.participants (exchange_id, user_id, display_name, is_demo)
    values (p_exchange_id, null, v_name, true)
    returning id into v_pid;
  exception when unique_violation then
    perform public._fail('DUPLICATE_NAME', 'Ya hay alguien con ese nombre en el intercambio.');
  end;
  insert into public.participant_preferences (participant_id) values (v_pid);
  return v_pid;
end;
$$;

-- Mi participación: nombre y preferencias -------------------------------
create or replace function public.update_my_participation(
  p_exchange_id uuid,
  p_display_name text,
  p_wishlist text,
  p_likes text,
  p_avoid text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := public._require_user();
  v_part public.participants;
  v_name text := public._clean_text(p_display_name, 60);
begin
  select * into v_part from public.participants
  where exchange_id = p_exchange_id and user_id = v_uid;
  if not found then
    perform public._fail('NOT_A_PARTICIPANT', 'No participas en este intercambio.');
  end if;

  -- Las preferencias se pueden actualizar siempre (ayudan a quien te regala).
  update public.participant_preferences
     set wishlist = public._clean_text(p_wishlist, 2000),
         likes = public._clean_text(p_likes, 2000),
         avoid = public._clean_text(p_avoid, 2000)
   where participant_id = v_part.id;

  -- El nombre forma parte de la lista de participantes: bloqueado tras el sorteo
  -- (el trigger lo impide si el nombre cambia).
  if v_name <> '' and v_name <> v_part.display_name then
    begin
      update public.participants set display_name = v_name where id = v_part.id;
    exception when unique_violation then
      perform public._fail('DUPLICATE_NAME',
        'Ya hay alguien con ese nombre en el intercambio. Agrega una inicial o un apodo.');
    end;
  end if;
end;
$$;

-- Exclusiones -----------------------------------------------------------
create or replace function public.add_exclusion(
  p_exchange_id uuid,
  p_giver_id uuid,
  p_receiver_id uuid,
  p_bidirectional boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ex public.exchanges := public._lock_exchange_as_organizer(p_exchange_id);
  v_id uuid;
begin
  if v_ex.status = 'drawn' then
    perform public._fail('EXCHANGE_LOCKED',
      'El sorteo ya se realizó: los participantes y las exclusiones están bloqueados.');
  end if;
  if p_giver_id is null or p_receiver_id is null or p_giver_id = p_receiver_id then
    perform public._fail('INVALID_EXCLUSION', 'Elige dos personas distintas.');
  end if;
  if (select count(*) from public.participants
      where exchange_id = p_exchange_id and id in (p_giver_id, p_receiver_id)) <> 2 then
    perform public._fail('INVALID_EXCLUSION', 'Ambas personas deben participar en este intercambio.');
  end if;
  begin
    insert into public.exclusions (exchange_id, giver_id, receiver_id, bidirectional)
    values (p_exchange_id, p_giver_id, p_receiver_id, coalesce(p_bidirectional, true))
    returning id into v_id;
  exception when unique_violation then
    perform public._fail('DUPLICATE_EXCLUSION',
      'Ya existe una exclusión entre estas dos personas. Elimínala si quieres cambiar su dirección.');
  end;
  return v_id;
end;
$$;

create or replace function public.remove_exclusion(p_exclusion_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_exchange_id uuid;
begin
  select exchange_id into v_exchange_id from public.exclusions where id = p_exclusion_id;
  perform public._lock_exchange_as_organizer(v_exchange_id);
  delete from public.exclusions where id = p_exclusion_id;
end;
$$;

-- Comprobar si el sorteo es posible sin guardarlo (no devuelve parejas) ---
create or replace function public.check_draw_feasibility(p_exchange_id uuid)
returns table (feasible boolean, code text, message text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_exchange_organizer(p_exchange_id) then
    perform public._fail('NOT_FOUND_OR_FORBIDDEN',
      'No encontramos el intercambio o no tienes permiso para administrarlo.');
  end if;
  begin
    perform 1 from public._compute_draw(p_exchange_id);
    return query select true, 'OK'::text, 'El sorteo es posible con las reglas actuales.'::text;
  exception when sqlstate 'P0001' then
    declare
      v_msg text;
      v_hint text;
    begin
      get stacked diagnostics v_msg = message_text, v_hint = pg_exception_hint;
      return query select false, v_msg, v_hint;
    end;
  end;
end;
$$;

-- Sortear ---------------------------------------------------------------
-- FOR UPDATE sobre el intercambio serializa solicitudes simultáneas: la
-- segunda espera a que termine la primera y recibe ALREADY_DRAWN.
create or replace function public.draw_exchange(p_exchange_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ex    public.exchanges := public._lock_exchange_as_organizer(p_exchange_id);
  v_count integer;
begin
  if v_ex.status = 'drawn' then
    perform public._fail('ALREADY_DRAWN', 'El sorteo ya se realizó. Actualiza la página para ver el estado.');
  end if;
  v_count := public._perform_draw(p_exchange_id, v_ex.draw_version + 1);
  -- Solo se devuelve un resumen; nunca las parejas.
  return jsonb_build_object('status', 'drawn', 'draw_version', v_ex.draw_version + 1, 'participants', v_count);
end;
$$;

-- Repetir el sorteo: exige confirmación explícita y la versión vigente,
-- para que un doble clic no provoque dos re-sorteos.
create or replace function public.redraw_exchange(
  p_exchange_id uuid,
  p_expected_version integer,
  p_confirm boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ex    public.exchanges := public._lock_exchange_as_organizer(p_exchange_id);
  v_count integer;
begin
  if coalesce(p_confirm, false) is not true then
    perform public._fail('CONFIRMATION_REQUIRED', 'Debes confirmar que quieres invalidar el sorteo anterior.');
  end if;
  if v_ex.status <> 'drawn' then
    perform public._fail('NOT_DRAWN', 'Este intercambio todavía no se ha sorteado.');
  end if;
  if p_expected_version is distinct from v_ex.draw_version then
    perform public._fail('STALE_VERSION',
      'El sorteo cambió mientras confirmabas. Actualiza la página e inténtalo de nuevo.');
  end if;
  delete from public.assignments where exchange_id = p_exchange_id;
  v_count := public._perform_draw(p_exchange_id, v_ex.draw_version + 1);
  return jsonb_build_object('status', 'drawn', 'draw_version', v_ex.draw_version + 1, 'participants', v_count);
end;
$$;

-- Anular el sorteo y reabrir para editar participantes/exclusiones.
create or replace function public.reopen_exchange(
  p_exchange_id uuid,
  p_expected_version integer,
  p_confirm boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ex public.exchanges := public._lock_exchange_as_organizer(p_exchange_id);
begin
  if coalesce(p_confirm, false) is not true then
    perform public._fail('CONFIRMATION_REQUIRED', 'Debes confirmar que quieres invalidar el sorteo anterior.');
  end if;
  if v_ex.status <> 'drawn' then
    perform public._fail('NOT_DRAWN', 'Este intercambio todavía no se ha sorteado.');
  end if;
  if p_expected_version is distinct from v_ex.draw_version then
    perform public._fail('STALE_VERSION',
      'El sorteo cambió mientras confirmabas. Actualiza la página e inténtalo de nuevo.');
  end if;
  delete from public.assignments where exchange_id = p_exchange_id;
  update public.exchanges set status = 'open', drawn_at = null where id = p_exchange_id;
end;
$$;

-- Mi asignación ---------------------------------------------------------
-- Devuelve solo la persona a quien le regala quien llama, con sus preferencias.
create or replace function public.get_my_assignment(p_exchange_id uuid, p_mark_revealed boolean default false)
returns table (
  receiver_name text,
  wishlist text,
  likes text,
  avoid text,
  draw_version integer,
  revealed_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public._require_user();
  v_assignment_id uuid;
begin
  select a.id into v_assignment_id
  from public.assignments a
  join public.participants g on g.id = a.giver_id
  where a.exchange_id = p_exchange_id and g.user_id = v_uid;

  if v_assignment_id is null then
    return;
  end if;

  if p_mark_revealed then
    update public.assignments as asg
       set revealed_at = coalesce(asg.revealed_at, now())
     where asg.id = v_assignment_id;
  end if;

  return query
  select r.display_name, coalesce(pp.wishlist, ''), coalesce(pp.likes, ''), coalesce(pp.avoid, ''),
         a.draw_version, a.revealed_at
  from public.assignments a
  join public.participants r on r.id = a.receiver_id
  left join public.participant_preferences pp on pp.participant_id = r.id
  where a.id = v_assignment_id;
end;
$$;

-- Estado de mi asignación sin revelar el nombre (para la UI).
create or replace function public.get_my_assignment_status(p_exchange_id uuid)
returns table (has_assignment boolean, draw_version integer, revealed_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select true, a.draw_version, a.revealed_at
  from public.assignments a
  join public.participants g on g.id = a.giver_id
  where a.exchange_id = p_exchange_id and g.user_id = (select auth.uid());
$$;

-- Cuántas personas ya vieron su resultado (agregado, sin parejas).
create or replace function public.get_reveal_progress(p_exchange_id uuid)
returns table (revealed integer, total integer)
language sql
stable
security definer
set search_path = ''
as $$
  select count(a.revealed_at)::integer, count(*)::integer
  from public.assignments a
  where a.exchange_id = p_exchange_id and public.is_exchange_organizer(p_exchange_id);
$$;

-- Lista de mis intercambios -------------------------------------------
create or replace function public.list_my_exchanges()
returns table (
  id uuid,
  name text,
  gift_date date,
  budget numeric,
  currency text,
  status text,
  is_demo boolean,
  is_organizer boolean,
  is_participant boolean,
  participant_count integer,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.name, e.gift_date, e.budget, e.currency, e.status, e.is_demo,
         e.organizer_id = (select auth.uid()),
         exists (select 1 from public.participants p
                 where p.exchange_id = e.id and p.user_id = (select auth.uid())),
         (select count(*)::integer from public.participants p where p.exchange_id = e.id),
         e.created_at
  from public.exchanges e
  where e.organizer_id = (select auth.uid())
     or exists (select 1 from public.participants p
                where p.exchange_id = e.id and p.user_id = (select auth.uid()))
  order by e.gift_date asc, e.created_at desc;
$$;

-- ---------------------------------------------------------------------
-- Permisos de ejecución: solo usuarios autenticados llaman a la API.
-- Las funciones internas (_*) no se exponen.
-- ---------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function
  public.is_exchange_organizer(uuid),
  public.is_exchange_member(uuid),
  public.create_exchange(text, date, numeric, text, text, boolean, text, boolean),
  public.update_exchange(uuid, text, date, numeric, text, text),
  public.delete_exchange(uuid),
  public.regenerate_invite_code(uuid),
  public.get_invite_preview(text),
  public.join_exchange(text, text, text, text, text),
  public.leave_exchange(uuid),
  public.remove_participant(uuid),
  public.add_demo_participant(uuid, text),
  public.update_my_participation(uuid, text, text, text, text),
  public.add_exclusion(uuid, uuid, uuid, boolean),
  public.remove_exclusion(uuid),
  public.check_draw_feasibility(uuid),
  public.draw_exchange(uuid),
  public.redraw_exchange(uuid, integer, boolean),
  public.reopen_exchange(uuid, integer, boolean),
  public.get_my_assignment(uuid, boolean),
  public.get_my_assignment_status(uuid),
  public.get_reveal_progress(uuid),
  public.list_my_exchanges()
to authenticated;

-- La vista previa de una invitación también se puede ver sin sesión.
grant execute on function public.get_invite_preview(text) to anon;

-- Las funciones creadas en el futuro tampoco se exponen por defecto.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
