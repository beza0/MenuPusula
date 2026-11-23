-- YEREL GELİŞTİRME: servis rollerinin parolaları .env'deki POSTGRES_PASSWORD ile ayarlanır.
\set pgpass `echo "$POSTGRES_PASSWORD"`
ALTER USER authenticator WITH PASSWORD :'pgpass';
ALTER USER pgbouncer WITH PASSWORD :'pgpass';
ALTER USER supabase_auth_admin WITH PASSWORD :'pgpass';
ALTER USER supabase_storage_admin WITH PASSWORD :'pgpass';
