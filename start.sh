#!/bin/sh

echo "Starting Genie services..."

# Start authentication service in the background
npm run start:auth &

# Start user service in the background
npm run start:user &

# Start api-gateway in the background
npm run start:gateway &

# Wait for any of the processes to exit
wait -n

echo "One of the services crashed. Exiting container."
exit 1
