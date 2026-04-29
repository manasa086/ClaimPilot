#!/bin/bash
# Start ClaimPilot with local PostgreSQL (Docker container)
# Overrides DATABASE_URL to point at the local db container.
# On first run, docker/init.sql creates all tables automatically.
# Note: Supabase Storage photos will not be accessible in local mode.
echo "Starting ClaimPilot → local PostgreSQL"
docker-compose -f docker-compose.yml -f docker-compose.local.yml up --build
