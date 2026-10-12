-- Migration fk_02_publish (Supabase-Projekt Kompendium): Übernahme des Formelkatalogs aus eng-core.
-- fk_publish(doc, commit): idempotenter Upsert aus publish/katalog.json.
-- fk_publish_github(commit, md5): lädt publish/katalog.json genau dieses Commits von GitHub (http-Erweiterung),
-- prüft die MD5-Summe und ruft fk_publish auf. Ausführen nur als postgres (Supabase-MCP), nicht für anon.
create or replace function public.fk_items(doc jsonb)
returns table (id text, area text, module text, quantity text, formula text, unit text, source text, example text, example_result numeric,
  example_case text, status text, approved_at date, approved_by text, comment text, sort integer)
language sql immutable set search_path = public as $$
  select * from jsonb_to_recordset(doc->'items') as x(id text, area text, module text, quantity text, formula text, unit text, source text,
    example text, example_result numeric, example_case text, status text, approved_at date, approved_by text, comment text, sort integer)
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

  insert into fk_formula_links (formula_id, kind, target) select i.id, 'tool', 'werkbank' from public.fk_items(doc) i on conflict do nothing;

  return query select v, (select count(*)::int from fk_formulas where not fk_formulas.retired),
    (select count(*)::int from fk_formulas where not fk_formulas.retired and fk_formulas.status = 'freigegeben'), n_changed, n_retired;
end $$;

create or replace function public.fk_publish_github(p_commit text, p_md5 text)
returns table (release text, aktiv integer, freigegeben integer, geaendert_oder_neu integer, retired integer)
language plpgsql set search_path = public, extensions as $$
declare r record; body text;
begin
  if p_commit !~ '^[0-9a-f]{7,40}$' then raise exception 'fk_publish_github: Commit-Hash ungültig'; end if;
  select * into r from extensions.http_get('https://raw.githubusercontent.com/yetu99/eng-core/' || p_commit || '/publish/katalog.json');
  if r.status <> 200 then raise exception 'fk_publish_github: HTTP % für Commit %', r.status, p_commit; end if;
  body := r.content;
  if md5(body) <> p_md5 then raise exception 'fk_publish_github: MD5 % erwartet, % erhalten', p_md5, md5(body); end if;
  return query select * from public.fk_publish(body::jsonb, p_commit);
end $$;

revoke all on function public.fk_items(jsonb) from public, anon, authenticated;
revoke all on function public.fk_publish(jsonb, text) from public, anon, authenticated;
revoke all on function public.fk_publish_github(text, text) from public, anon, authenticated;
