begin;

alter table public.ac_hoteis
  add column if not exists comodidades text[] not null default '{}';

grant update (nome, cidade, uf, endereco, telefone, comodidades)
  on public.ac_hoteis to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ac_hoteis'
      and policyname = 'Autor atualiza seu hotel'
  ) then
    create policy "Autor atualiza seu hotel"
      on public.ac_hoteis for update to authenticated
      using (criado_por = (select auth.uid()))
      with check (criado_por = (select auth.uid()));
  end if;
end;
$$;

commit;

select 'Comodidades de hotéis preparadas' as resultado;
