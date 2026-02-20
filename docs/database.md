users (
  id uuid primary key,
  username text,
  profile_name text,
  email text,
  avatar_url text,
  created_at timestamptz,
  update_at timestamptz,
  deleted_at timestamptz
)
trips (
  id uuid primary key,
  title text,
  created_at timestamptz,
  start_date date,
  end_date date,
  status text,
  memo text,
  owner_id int8,
  owner_user_id uuid
)
trip_members (
  id int8 primary key,
  user_id uuid,
  joined_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  deleted_at timestamptz,
  trip_id uuid
)
photos (
  id int8 primary key,
  user_id uuid,
  trip_id uuid,
  image_url text,
  lat float8,
  lng float8,
  created_at timestamptz,
  updated_at timestamptz,
  deleted_at timestamptz
)
notifications (
  id uuid primary key,
  trip_id uuid,
  type text,
  scheduled_at timestamptz,
  sent_at timestamptz,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  deleted_at timestamptz
)
users (1) ──< trips (N)
  trips.owner_user_id → users.id

users (N) >──< trip_members >──< trips (N)
  trip_members.user_id → users.id
  trip_members.trip_id → trips.id

trips (1) ──< photos (N)
  photos.trip_id → trips.id

users (1) ──< photos (N)
  photos.user_id → users.id

trips (1) ──< notifications (N)
  notifications.trip_id → trips.id