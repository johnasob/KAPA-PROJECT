"""Check fresh installation, upgrading an existing owner, and rollback of a partial schema.

Uses disposable databases inside the named LOCAL Supabase container only.
It never reads hosted credentials or resets the user's development database.
"""
from pathlib import Path
import subprocess
from uuid import uuid4

CONTAINER = "supabase_db_KAPA-PROJECT"
ROOT = Path(__file__).resolve().parent.parent
OWNER = "71000000-0000-0000-0000-000000000001"
BASE = """
create schema auth;
create function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to authenticated,anon;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,
raw_user_meta_data jsonb default '{}',created_at timestamptz default now());
create schema storage;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets,name text);
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated,anon;
grant select,insert,delete on storage.objects to authenticated;
insert into auth.users(id,email,email_confirmed_at) values
('71000000-0000-0000-0000-000000000001','owner-installer@kapa.test',now());
"""


def sql(db, text, ok=True):
    result = subprocess.run(
        ["docker", "exec", "-i", CONTAINER, "psql", "-U", "postgres", "-d", db,
         "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1"],
        input=text, text=True, capture_output=True,
    )
    if ok and result.returncode:
        raise RuntimeError(result.stderr)
    if not ok and result.returncode == 0:
        raise AssertionError("Expected a partial installation to be rejected")
    return result.stdout.strip()


def make_db():
    name = "kapa_installer_test_" + uuid4().hex[:12]
    subprocess.run(["docker", "exec", CONTAINER, "createdb", "-U", "postgres", name], check=True)
    return name


installer = (ROOT / "release/KAPA-3D-instalacion.sql").read_text()
activation = (ROOT / "supabase/activate-first-admin.sql").read_text().replace(
    "ESCRIBE_AQUI_TU_CORREO", "owner-installer@kapa.test", 1
)
# The guard must still compare against the unchanged placeholder.
databases = []
try:
    for mode in ["fresh", "upgrade"]:
        db = make_db()
        databases.append(db)
        sql(db, BASE)
        sql(db, "insert into storage.buckets(id,name,public) values('kapa-order-files','kapa-order-files',true);")
        if mode == "upgrade":
            for migration in ["20261019000100_foundations.sql", "20261020000100_registration.sql"]:
                sql(db, (ROOT / "supabase/migrations" / migration).read_text())
            sql(db, activation)
            sql(db, "update public.business_settings set business_name='KAPA existente',labor_hour_cost=12345.67;")
        sql(db, installer)
        assert sql(db,"select public from storage.buckets where id='kapa-order-files'")=="f"
        if mode == "fresh":
            sql(db, activation)
        sql(db, """set request.jwt.claim.sub='71000000-0000-0000-0000-000000000001';
set role authenticated;
select public.business_operate('customer_save','{"name":"Cliente conservado"}',gen_random_uuid());
select public.business_operate('cash_create','{"category":"capital","amount":"123.45","description":"Aporte conservado"}',gen_random_uuid());
""")
        before = sql(db, "select jsonb_build_array((select user_id from public.user_profiles),(select business_name from public.business_settings),(select labor_hour_cost from public.business_settings),(select count(*) from public.printers),(select count(*) from public.customers),(select sum(amount) from public.cash_entries),(select count(*) from public.audit_log));")
        sql(db, installer)
        after = sql(db, "select jsonb_build_array((select user_id from public.user_profiles),(select business_name from public.business_settings),(select labor_hour_cost from public.business_settings),(select count(*) from public.printers),(select count(*) from public.customers),(select sum(amount) from public.cash_entries),(select count(*) from public.audit_log));")
        assert before == after, (mode, before, after)
        if mode == "upgrade":
            assert sql(db, "select business_name||':'||labor_hour_cost from public.business_settings") == "KAPA existente:12345.67"
        print("PASS:", mode, "conserva cuenta, configuración, operaciones y auditoría al repetirse")
    db = make_db()
    databases.append(db)
    sql(db, BASE + "create table public.customers(id integer primary key);insert into public.customers values(7);")
    sql(db, installer, ok=False)
    assert sql(db, "select to_regclass('public.business_settings') is null") == "t"
    assert sql(db, "select id from public.customers") == "7"
    print("PASS: instalación parcial rechazada con rollback completo y datos originales intactos")
finally:
    for db in databases:
        assert db.startswith("kapa_installer_test_")
        subprocess.run(["docker", "exec", CONTAINER, "dropdb", "-U", "postgres", "--force", db], check=True)
