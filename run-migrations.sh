#!/bin/bash
# Script to run database migrations in Docker container

echo "Running database migrations..."
docker exec -it facility-reservation-app npm run migrate

if [ $? -eq 0 ]; then
    echo ""
    echo "✓ Migrations completed successfully!"
    echo ""
    echo "You can now access the application at:"
    echo "  http://localhost"
    echo ""
    echo "Default admin credentials:"
    echo "  Email: admin@facility.local"
    echo "  Password: admin123"
else
    echo ""
    echo "✗ Migration failed. Please check the logs above."
    exit 1
fi
