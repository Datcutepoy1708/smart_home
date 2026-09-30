-- AlterEnum: Add 'cover' and 'rain_sensor' values to DeviceType
-- These device types were added in the hardware v2 upgrade (ESP32-S3 with TB6612 cover motor and rain sensor)

ALTER TYPE "DeviceType" ADD VALUE IF NOT EXISTS 'cover';
ALTER TYPE "DeviceType" ADD VALUE IF NOT EXISTS 'rain_sensor';
