-- OMEat core schema: destinations, finds, find_images, submissions, confirms.
-- Public read is anon SELECT only; all public writes go through server
-- route handlers using the service role key. Curators use authenticated role.

-- Enums
create type payment_method as enum ('cash', 'card', 'both');
create type find_status as enum ('published', 'archived');
create type submission_type as enum ('new_find', 'update');
create type submission_status as enum ('pending', 'published', 'rejected');

-- Tables
create table destinations (
  id uuid primary key default gen_random_uuid(),
  iata char(3) not null unique check (iata = upper(iata)),
  city text not null,
  country text not null,
  slug text not null unique
);

create table finds (
  id uuid primary key default gen_random_uuid(),
  destination_id uuid not null references destinations (id) on delete cascade,
  dish text not null,
  place text not null,
  airside boolean not null,
  terminal_area text,
  walking_time text,
  cost_amount numeric(10, 2),
  cost_currency char(3),
  payment payment_method,
  opening_hours text,
  directions text,
  maps_url text,             -- landside only, plain pasted link
  submitter_display text,    -- "First name + last initial" only
  status find_status not null default 'published',
  confirm_count integer not null default 0,
  last_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not (airside and maps_url is not null))  -- maps_url is landside only
);

create table find_images (
  id uuid primary key default gen_random_uuid(),
  find_id uuid not null references finds (id) on delete cascade,
  storage_path text not null,
  alt_text text not null,
  sort_order integer not null default 0
);

create table submissions (
  id uuid primary key default gen_random_uuid(),
  type submission_type not null,
  find_id uuid references finds (id) on delete set null,  -- set for 'update'
  payload jsonb not null,
  submitter_display text,
  status submission_status not null default 'pending',
  created_at timestamptz not null default now(),
  check (type != 'update' or find_id is not null)
);

create table confirms (
  id uuid primary key default gen_random_uuid(),
  find_id uuid not null references finds (id) on delete cascade,
  device_hash text not null,
  created_at timestamptz not null default now(),
  unique (find_id, device_hash)
);

create index finds_destination_id_idx on finds (destination_id);
create index find_images_find_id_idx on find_images (find_id);
create index confirms_find_id_idx on confirms (find_id);
create index submissions_status_idx on submissions (status);

-- Keep finds.updated_at current
create function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger finds_set_updated_at
  before update on finds
  for each row execute function set_updated_at();

-- Bump confirm_count and freshness on each confirm
create function apply_confirm()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update finds
     set confirm_count = confirm_count + 1,
         last_confirmed_at = new.created_at
   where id = new.find_id;
  return new;
end;
$$;

create trigger confirms_apply
  after insert on confirms
  for each row execute function apply_confirm();

-- RLS
alter table destinations enable row level security;
alter table finds enable row level security;
alter table find_images enable row level security;
alter table submissions enable row level security;
alter table confirms enable row level security;

-- anon: read-only, and only what the public site needs
create policy anon_read_destinations on destinations
  for select to anon using (true);

create policy anon_read_published_finds on finds
  for select to anon using (status = 'published');

create policy anon_read_find_images on find_images
  for select to anon using (true);

-- No anon policies on submissions or confirms, and no anon write policies
-- anywhere: public writes arrive via server routes with the service role key,
-- which bypasses RLS.

-- authenticated: curators, full access
create policy curator_all_destinations on destinations
  for all to authenticated using (true) with check (true);

create policy curator_all_finds on finds
  for all to authenticated using (true) with check (true);

create policy curator_all_find_images on find_images
  for all to authenticated using (true) with check (true);

create policy curator_all_submissions on submissions
  for all to authenticated using (true) with check (true);

create policy curator_all_confirms on confirms
  for all to authenticated using (true) with check (true);
