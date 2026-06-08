-- Ensure password is stored with md5 to match pg_hba.conf auth method
ALTER SYSTEM SET password_encryption = 'md5';
SELECT pg_reload_conf();
ALTER USER tesis_user WITH PASSWORD 'tesis_password';
