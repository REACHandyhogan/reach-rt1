# REACH Tool #1 - Render-ready two-phone prototype

**00R4SR RT1 - The 30-Second Rule / Your First REACH Gift**

This version is prepared for a public HTTPS deployment on Render and includes:
- QR pairing for the second phone
- synchronized WebSocket coaching
- synchronized 30-second timers
- role-specific speaker/listener instructions
- `/health` service health check
- WebSocket ping/pong keepalive
- `render.yaml` deployment configuration
- no registration, name, or email required

## Fastest live deployment

1. Put the files in this folder into a GitHub repository.
2. Sign in to Render and choose **New > Blueprint** (or **New > Web Service**).
3. Connect the GitHub repository.
4. If using Blueprint, Render reads `render.yaml`.
5. Create/deploy the service.
6. Open the HTTPS `onrender.com` URL Render gives you.
7. On Phone A, tap **Let's REACH**.
8. Scan the QR code with Phone B.
9. Both phones should connect to the same coaching session.

### Manual Web Service settings

- Runtime: Node
- Build command: `npm install`
- Start command: `npm start`
- Health check path: `/health`
- Instance: Free is sufficient for testing

## Important testing note

Free Render web services can sleep during inactivity, so the first opening after a period of inactivity can take longer. For live presentations, use an always-on instance or open the tool shortly before the session.

## Production note

The prototype stores active session state in server memory. That is appropriate for a single-instance test. Before scaling to multiple server instances, move session state to a shared store.
