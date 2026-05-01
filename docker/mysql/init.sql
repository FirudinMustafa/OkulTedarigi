-- MySQL initialization script
-- This runs automatically when the container starts for the first time

-- Grant all privileges to the app user
GRANT ALL PRIVILEGES ON okul_tedarik.* TO 'okul_user'@'%';
FLUSH PRIVILEGES;

-- Set timezone
SET GLOBAL time_zone = '+03:00';
