#!/bin/bash

echo "Continue? [NO]"
read CONTINUE

if [ "$CONTINUE" == "YES" ]; then
    echo "Dropping DB"
    sudo su postgres -c "dropdb dogetunnel; createdb dogetunnel"
    psql -h localhost dogetunnel dogetunnel < schema.sql
fi
