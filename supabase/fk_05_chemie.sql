-- Migration fk_05_chemie (Supabase-Projekt Kompendium, eng-core 0.24.0): Modul chemie (Werkzeug Chemiewerk) im Formelkatalog.
-- 1. Check-Constraint fk_formulas.module um chemie erweitern (DROP nur des Checks, keine Daten).
--    Grundlage: Konzept chemie/konzept_chemie.md (26.11.2026, Präfix CH, Modul chemie). Werte wie src/modules.json im Repo eng-core.
-- 2. fk_tools_of_module: chemie → chemiewerk (Werkzeug-Verweis in fk_formula_links, kind 'tool').
-- fk_publish bleibt unverändert. Idempotent. Ausführen als postgres, nicht über anon.
begin;

do $$
declare def text;
begin
  select pg_get_constraintdef(c.oid) into def
  from pg_constraint c join pg_class t on t.oid = c.conrelid
  where t.relname = 'fk_formulas' and c.conname = 'fk_formulas_module_check';
  if def is null or def not like '%chemie%' then
    alter table public.fk_formulas drop constraint if exists fk_formulas_module_check;
    alter table public.fk_formulas add constraint fk_formulas_module_check
      check (module in ('festigkeit','ashby','gemeinsam','fluid','verbindungen','dichtungen','stabwerke','kinematik','elektrik','chemie'));
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
    when 'kinematik' then array['greifwerk']
    when 'elektrik' then array['stromwerk']
    when 'chemie' then array['chemiewerk']
  end
$$;

revoke all on function public.fk_tools_of_module(text) from public, anon, authenticated;

commit;
