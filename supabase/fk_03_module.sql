-- Migration fk_03_module (Supabase-Projekt Kompendium, eng-core 0.10.0): Module der Fachtools im Formelkatalog.
-- 1. Check-Constraint fk_formulas.module um fluid, verbindungen, dichtungen, stabwerke erweitern.
--    Enthält DROP CONSTRAINT (nur der Check, keine Daten). Freigegeben mit Entscheidung F2 (Architekturkonzept
--    Fachtools, 28.10.2026). Werte wie src/modules.json im Repo eng-core.
-- 2. fk_publish: Werkzeug-Verweis (fk_formula_links, kind 'tool') je Modul statt fest 'werkbank':
--    festigkeit, ashby → werkbank; fluid, verbindungen, dichtungen, stabwerke → fachtools; gemeinsam → beide.
--    Bestehende Verweise bleiben (on conflict do nothing).
-- Idempotent. Ausführen im Supabase SQL Editor (als postgres), nicht über anon.
begin;

do $$
declare def text;
begin
  select pg_get_constraintdef(c.oid) into def
  from pg_constraint c join pg_class t on t.oid = c.conrelid
  where t.relname = 'fk_formulas' and c.conname = 'fk_formulas_module_check';
  if def is null or def not like '%stabwerke%' then
    alter table public.fk_formulas drop constraint if exists fk_formulas_module_check;
    alter table public.fk_formulas add constraint fk_formulas_module_check
      check (module in ('festigkeit','ashby','gemeinsam','fluid','verbindungen','dichtungen','stabwerke'));
  end if;
end $$;

create or replace function public.fk_tools_of_module(p_module text) returns text[]
language sql immutable set search_path = public as $$
  select case p_module
    when 'gemeinsam' then array['werkbank','fachtools']
    when 'festigkeit' then array['werkbank']
    when 'ashby' then array['werkbank']
    when 'fluid' then array['fachtools']
    when 'verbindungen' then array['fachtools']
    when 'dichtungen' then array['fachtools']
    when 'stabwerke' then array['fachtools']
  end
$$;

create or replace function public.fk_publish(doc jsonb, p_commit text default null)
returns table (release text, aktiv integer, freigegeben integer, geaendert_oder_neu integer, retired integer)
language plpgsql set search_path = public as $$
declare
  v text := doc->>'core';
  n_changed integer; n_retired integer;
begin
  if v is null or jsonb_typeof(doc->'items') <> 'array' then raise exception 'fk_publish: Dokument ohne core oder items'; end if;
  if (doc->>'formulas')::int <> jsonb_array_length(doc->'items') then raise exception 'fk_publish: Anzahl stimmt nicht'; end if;
  if exists (select 1 from public.fk_items(doc) i where public.fk_tools_of_module(i.module) is null) then
    raise exception 'fk_publish: Formel mit unbekanntem Modul (%)', (select string_agg(distinct i.module, ', ') from public.fk_items(doc) i where public.fk_tools_of_module(i.module) is null);
  end if;
  perform set_config('fk.release', v, true);

  insert into fk_releases (version, core_commit, data_version, formulas, approved, notes)
  values (v, p_commit, doc->>'data', (doc->>'formulas')::int, (doc->>'approved')::int, 'Spiegel aus eng-core publish/katalog.json')
  on conflict (version) do update set core_commit = coalesce(excluded.core_commit, fk_releases.core_commit),
    data_version = excluded.data_version, formulas = excluded.formulas, approved = excluded.approved
  where (fk_releases.core_commit, fk_releases.data_version, fk_releases.formulas, fk_releases.approved)
    is distinct from (coalesce(excluded.core_commit, fk_releases.core_commit), excluded.data_version, excluded.formulas, excluded.approved);

  -- Verlauf zuerst: neue Formeln oder geänderter Text/Status gegenüber dem Spiegel
  insert into fk_formulas (id, area, module, quantity, formula, status, since_version, last_version)
  select i.id, i.area, i.module, i.quantity, i.formula, i.status, v, v from public.fk_items(doc) i
  where not exists (select 1 from fk_formulas f where f.id = i.id);

  insert into fk_formula_versions (formula_id, version, formula, status)
  select i.id, v, i.formula, i.status from public.fk_items(doc) i
  where not exists (select 1 from fk_formula_versions h where h.formula_id = i.id)
     or exists (select 1 from fk_formulas f where f.id = i.id and (f.formula is distinct from i.formula or f.status is distinct from i.status))
  on conflict (formula_id, version) do update set formula = excluded.formula, status = excluded.status
  where (fk_formula_versions.formula, fk_formula_versions.status) is distinct from (excluded.formula, excluded.status);
  get diagnostics n_changed = row_count;

  update fk_formulas f set area = i.area, module = i.module, quantity = i.quantity, formula = i.formula, unit = i.unit, source = i.source,
    example = i.example, example_result = i.example_result, example_case = i.example_case, status = i.status, approved_at = i.approved_at,
    approved_by = i.approved_by, comment = i.comment, sort = i.sort, last_version = v, retired = false, updated_at = now()
  from public.fk_items(doc) i
  where f.id = i.id and (f.area, f.module, f.quantity, f.formula, f.unit, f.source, f.example, f.example_result, f.example_case, f.status,
      f.approved_at, f.approved_by, f.comment, f.sort, f.last_version, f.retired)
    is distinct from (i.area, i.module, i.quantity, i.formula, i.unit, i.source, i.example, i.example_result, i.example_case, i.status,
      i.approved_at, i.approved_by, i.comment, i.sort, v, false);

  update fk_formulas f set retired = true, updated_at = now() where not f.retired and not exists (select 1 from public.fk_items(doc) i where i.id = f.id);
  get diagnostics n_retired = row_count;

  insert into fk_formula_links (formula_id, kind, target)
  select i.id, 'tool', t from public.fk_items(doc) i cross join lateral unnest(public.fk_tools_of_module(i.module)) t
  on conflict do nothing;

  return query select v, (select count(*)::int from fk_formulas where not fk_formulas.retired),
    (select count(*)::int from fk_formulas where not fk_formulas.retired and fk_formulas.status = 'freigegeben'), n_changed, n_retired;
end $$;

revoke all on function public.fk_tools_of_module(text) from public, anon, authenticated;
revoke all on function public.fk_publish(jsonb, text) from public, anon, authenticated;

commit;
