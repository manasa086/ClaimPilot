#!/bin/bash
# Start ClaimPilot with Supabase (cloud database)
# Uses DATABASE_URL from .env — points to Supabase
echo "Starting ClaimPilot → Supabase (cloud)"
docker-compose up --build
