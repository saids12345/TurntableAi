-- ============================================================
-- TurnTableAI POS Connections
--
-- Server-only storage for POS OAuth credentials and locations.
-- OAuth tokens stored here must be encrypted by TurnTableAI
-- before they are written to the database.
-- ============================================================

create table if not exists
  public.pos_connections (
    id uuid
      primary key
      default gen_random_uuid(),

    user_id uuid
      not null
      references auth.users(id)
      on delete cascade,

    provider text
      not null
      check (
        provider in (
          'square',
          'toast',
          'clover',
          'lightspeed'
        )
      ),

    environment text
      not null
      default 'production'
      check (
        environment in (
          'sandbox',
          'production'
        )
      ),

    provider_account_id text
      not null,

    access_token_encrypted text
      not null,

    refresh_token_encrypted text,

    access_token_expires_at timestamptz,

    refresh_token_expires_at timestamptz,

    scopes text[]
      not null
      default '{}',

    last_synced_at timestamptz,

    created_at timestamptz
      not null
      default now(),

    updated_at timestamptz
      not null
      default now(),

    unique (
      user_id,
      provider,
      environment,
      provider_account_id
    )
  );

create table if not exists
  public.pos_locations (
    id uuid
      primary key
      default gen_random_uuid(),

    connection_id uuid
      not null
      references public.pos_connections(id)
      on delete cascade,

    provider_location_id text
      not null,

    name text
      not null,

    timezone text,

    currency text,

    status text,

    created_at timestamptz
      not null
      default now(),

    updated_at timestamptz
      not null
      default now(),

    unique (
      connection_id,
      provider_location_id
    )
  );

create index if not exists
  pos_connections_user_provider_idx
on public.pos_connections (
  user_id,
  provider
);

create index if not exists
  pos_locations_connection_idx
on public.pos_locations (
  connection_id
);

alter table
  public.pos_connections
enable row level security;

alter table
  public.pos_locations
enable row level security;

revoke all
on table
  public.pos_connections
from
  anon,
  authenticated;

revoke all
on table
  public.pos_locations
from
  anon,
  authenticated;

grant
  select,
  insert,
  update,
  delete
on table
  public.pos_connections
to
  service_role;

grant
  select,
  insert,
  update,
  delete
on table
  public.pos_locations
to
  service_role;
