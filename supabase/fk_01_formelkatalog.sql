-- Migration fk_01_formelkatalog (Supabase-Projekt Kompendium), eingespielt am 11.10.2026 über das Supabase-MCP.
-- Formelkatalog als Spiegel von eng-core. Master ist eng-core (Git, Tests, Gegenrechnung).
-- Schreiben nur über scripts/katalog-publish.ts mit gesetztem fk.release. Idempotent, ohne drop.
create table if not exists public.fk_releases (
  version      text primary key,
  core_commit  text,
  data_version text,
  released_at  timestamptz not null default now(),
  formulas     integer not null default 0,
  approved     integer not null default 0,
  notes        text
);

create table if not exists public.fk_formulas (
  id             text primary key,
  area           text not null,
  module         text not null default 'festigkeit' check (module in ('festigkeit','ashby','gemeinsam')),
  quantity       text not null,
  formula        text not null,
  unit           text,
  source         text,
  example        text,
  example_result numeric,
  example_case   text,
  status         text not null default 'offen' check (status in ('offen','freigegeben','abgelehnt','geaendert')),
  approved_at    date,
  approved_by    text,
  comment        text,
  sort           integer not null default 0,
  since_version  text references public.fk_releases(version),
  last_version   text references public.fk_releases(version),
  retired        boolean not null default false,
  updated_at     timestamptz not null default now()
);

create table if not exists public.fk_formula_versions (
  formula_id text not null references public.fk_formulas(id),
  version    text not null references public.fk_releases(version),
  formula    text not null,
  status     text not null,
  primary key (formula_id, version)
);

create table if not exists public.fk_formula_links (
  formula_id text not null references public.fk_formulas(id),
  kind       text not null check (kind in ('symbol','entry','wa_property','tool')),
  target     text not null,
  note       text,
  primary key (formula_id, kind, target)
);

create index if not exists fk_formulas_area_idx on public.fk_formulas(area, sort);
create index if not exists fk_links_target_idx on public.fk_formula_links(kind, target);

create or replace function public.fk_guard() returns trigger language plpgsql set search_path = public as $$
begin
  if coalesce(current_setting('fk.release', true), '') = '' then
    raise exception 'fk_*: Aenderung nur ueber katalog-publish mit gesetztem fk.release';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['fk_releases','fk_formulas','fk_formula_versions','fk_formula_links'] loop
    if not exists (select 1 from pg_trigger where tgname = t || '_guard') then
      execute format('create trigger %I before insert or update or delete on public.%I for each row execute function public.fk_guard()', t || '_guard', t);
    end if;
    execute format('alter table public.%I enable row level security', t);
    if not exists (select 1 from pg_policies where tablename = t and policyname = 'fk_read') then
      execute format('create policy fk_read on public.%I for select to anon, authenticated using (true)', t);
    end if;
    execute format('revoke insert, update, delete on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to anon, authenticated', t);
  end loop;
end $$;

create or replace view public.fk_v_current_release with (security_invoker = true) as
  select * from public.fk_releases order by released_at desc limit 1;

create or replace view public.fk_v_formulas with (security_invoker = true) as
  select f.*,
         coalesce((select jsonb_agg(jsonb_build_object('kind', l.kind, 'target', l.target) order by l.kind, l.target)
                   from public.fk_formula_links l where l.formula_id = f.id), '[]'::jsonb) as links
  from public.fk_formulas f
  where not f.retired;

grant select on public.fk_v_current_release, public.fk_v_formulas to anon, authenticated;

comment on table public.fk_formulas is 'Formelkatalog der Ingenieur-Tools. Spiegel von eng-core (Master). Nur lesen; gerechnet wird ausschliesslich im Kern.';
